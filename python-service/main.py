"""
insta-pilot — Python FastAPI service.

Промежуточный слой между Laravel и Instagram API (instagrapi).
Принимает запросы от Laravel, выполняет действия через instagrapi
и возвращает нормализованный JSON.

Эндпоинты:
  GET  /health                — проверка доступности сервиса
  POST /auth/login            — авторизация по логину и паролю
  POST /account/info          — базовая информация об аккаунте
  POST /account/feed          — лента постов (начальная загрузка + пагинация)
  POST /media/like            — поставить лайк посту
  POST /media/comment         — оставить комментарий к посту
  POST /user/info             — публичный профиль пользователя по PK
  POST /search/hashtag        — поиск постов по хэштегу
  POST /search/locations      — поиск геолокаций по названию
  POST /search/location       — посты по конкретной геолокации

Многопоточность:
  Один uvicorn worker + asyncio.to_thread для каждого instagrapi-вызова.
  account_lock гарантирует, что для одного аккаунта не более одного
  параллельного запроса к Instagram. Разные аккаунты — независимы.
"""

import asyncio
import json
from urllib.parse import quote

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from instagrapi import Client

from client import _make_client
from helpers import (
    _extract_posts,
    _fetch_sections,
    _instagram_response_debug,
    _paginate_feed,
    _serialize_comment,
)
from lock import account_lock
from schemas import (
    AccountInfoResponse,
    CommentRequest,
    CommentResponse,
    FeedRequest,
    FeedResponse,
    FetchCommentsRequest,
    FetchCommentsResponse,
    FetchCommentRepliesRequest,
    FetchCommentRepliesResponse,
    LoginRequest,
    LoginResponse,
    MediaLikeRequest,
    MediaLikeResponse,
    SearchHashtagRequest,
    SearchLocationRequest,
    SearchLocationsRequest,
    SearchLocationsResponse,
    SearchResponse,
    SessionRequest,
    UserInfoByPkRequest,
    UserInfoByPkResponse,
)
from utils import error_to_code, error_to_http_status


app = FastAPI(title="insta-pilot python service")


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Проверка доступности сервиса. Используется Docker healthcheck и Laravel."""
    return {"status": "ok"}


# ─── Auth ─────────────────────────────────────────────────────────────────────

@app.post("/auth/login")
async def login(data: LoginRequest):
    """
    Авторизация в Instagram по логину и паролю.

    Создаёт свежий Client (не из кеша), применяет прокси и профиль устройства,
    выполняет login() и сохраняет полученную сессию в JSON.
    После успешного логина возвращает session_data, full_name и profile_pic_url —
    эти данные Laravel сохраняет в таблице instagram_accounts.

    Ошибки instagrapi (ChallengeRequired, LoginRequired и др.) транслируются
    в понятный error_code через utils.error_to_code.

    Лок по аккаунту не используется — логин всегда на свежем Client,
    без session_data (сессии ещё нет).
    """
    def _run():
        try:
            # Логин всегда на чистом клиенте — кеш здесь неуместен,
            # так как сессия ещё не существует
            cl = Client()

            # Прокси задаётся до авторизации, иначе первый запрос уйдёт без него
            if data.proxy:
                cl.set_proxy(data.proxy)

            # Профиль устройства (device_settings + user_agent) — имитирует конкретный
            # Android-телефон, снижает вероятность блокировки
            if data.device_profile:
                device_settings = data.device_profile.get("device_settings")
                user_agent = data.device_profile.get("user_agent")
                if isinstance(device_settings, dict):
                    cl.set_device(device_settings)
                if isinstance(user_agent, str) and user_agent:
                    cl.set_user_agent(user_agent)

            # Непосредственно логин — может бросить ChallengeRequired / LoginRequired
            cl.login(data.login, data.password)

            # Сохраняем состояние клиента (куки, device id, токены) в JSON-строку
            session_data = json.dumps(cl.get_settings())

            # Получаем базовую информацию об аккаунте сразу после логина
            user_info = cl.account_info()

            return LoginResponse(
                success=True,
                session_data=session_data,
                full_name=user_info.full_name,
                profile_pic_url=str(user_info.profile_pic_url),
            )
        except Exception as e:
            code = error_to_code(e)
            return JSONResponse(
                status_code=error_to_http_status(code),
                content=LoginResponse(success=False, error=str(e), error_code=code).model_dump(),
            )

    return await asyncio.to_thread(_run)


# ─── Account ──────────────────────────────────────────────────────────────────

@app.post("/account/info")
async def account_info(data: SessionRequest):
    """
    Возвращает базовую статистику аккаунта: число подписчиков и подписок.

    Используется для актуализации данных в Laravel после долгого простоя
    или для проверки валидности сессии (невалидная сессия → LoginRequired → 401).
    """
    def _run():
        try:
            cl = _make_client(data.session_data)
            info = cl.account_info()

            return AccountInfoResponse(
                success=True,
                user_pk=info.pk,
            )
        except Exception as e:
            code = error_to_code(e)
            return JSONResponse(
                status_code=error_to_http_status(code),
                content=AccountInfoResponse(success=False, error=str(e), error_code=code).model_dump(),
            )

    async with account_lock(data.session_data):
        return await asyncio.to_thread(_run)


@app.post("/account/feed", response_model=FeedResponse)
async def get_feed(data: FeedRequest):
    """
    Загружает ленту Instagram-аккаунта.

    Два режима работы:

    1. Начальная загрузка (max_id не передан):
       Вызывает get_timeline_feed(reason), где reason — тип открытия приложения
       (cold_start_fetch / pull_to_refresh / warm_start_fetch).
       Если постов меньше min_posts — делает дополнительные запросы пагинации.

    2. Пагинация (max_id передан):
       Продолжает с места остановки через POST feed/timeline/ с seen_posts
       и feed_view_info. Без seen_posts Instagram возвращает дубли.

    В обоих режимах возвращает next_max_id и more_available для следующего запроса.
    """
    def _run():
        try:
            cl = _make_client(data.session_data)

            # ── Режим пагинации ────────────────────────────────────────────────────
            if data.max_id:
                # Восстанавливаем список уже показанных id из строки через запятую
                seen = [s for s in (data.seen_posts or "").split(",") if s]
                all_posts: list[dict] = []

                # _paginate_feed мутирует all_posts и seen на месте
                next_max_id, more_available = _paginate_feed(
                    cl, data.max_id, seen, all_posts, data.min_posts, "pagination"
                )

                debug_info = {
                    "instagram_request": {
                        "method": "feed/timeline/ (pagination)",
                        "max_id": data.max_id,
                        "seen_posts_count": len(seen),
                    },
                    # last_json — сырой ответ последнего запроса клиента
                    "instagram_response": _instagram_response_debug(getattr(cl, "last_json", None)),
                }

                return FeedResponse(
                    success=True,
                    posts=all_posts,
                    next_max_id=next_max_id,
                    more_available=more_available,
                    debug_info=debug_info,
                )

            # ── Начальная загрузка ─────────────────────────────────────────────────

            # Пропускаем невалидный reason — Instagram ожидает конкретные строки
            reason = (
                data.reason
                if data.reason in ("cold_start_fetch", "pull_to_refresh", "warm_start_fetch")
                else "cold_start_fetch"
            )

            raw = cl.get_timeline_feed(reason)
            all_posts = _extract_posts(raw)
            next_max_id = raw.get("next_max_id")
            more_available = bool(raw.get("more_available", False)) and bool(next_max_id)

            # Собираем id всех показанных постов — понадобятся при пагинации
            seen = [p["id"] for p in all_posts]

            print(f"[FEED] initial={len(all_posts)}, next_max_id={'yes' if next_max_id else 'no'}")

            # Если первой страницы недостаточно для min_posts — докачиваем
            if data.min_posts and len(all_posts) < data.min_posts and more_available:
                next_max_id, more_available = _paginate_feed(
                    cl, next_max_id, seen, all_posts, data.min_posts, "extra"
                )

            # debug_info для начального запроса использует raw до пагинации
            debug_info = {
                "instagram_request": {"method": "get_timeline_feed", "reason": reason},
                "instagram_response": _instagram_response_debug(raw),
            }

            return FeedResponse(
                success=True,
                posts=all_posts,
                next_max_id=next_max_id,
                more_available=more_available,
                debug_info=debug_info,
            )
        except Exception as e:
            code = error_to_code(e)
            return JSONResponse(
                status_code=error_to_http_status(code),
                content=FeedResponse(success=False, error=str(e), error_code=code).model_dump(),
            )

    async with account_lock(data.session_data):
        return await asyncio.to_thread(_run)


# ─── Media ────────────────────────────────────────────────────────────────────

@app.post("/media/like")
async def like_media(data: MediaLikeRequest):
    """
    Ставит лайк посту по media_id (формат: {media_pk}_{user_pk}).

    media_id — составной идентификатор, который принимает instagrapi.media_like().
    В отличие от media_pk, содержит привязку к автору поста.

    В debug_info возвращается сырой ответ Instagram для логирования в Laravel.
    """
    def _run():
        try:
            cl = _make_client(data.session_data)

            # media_like принимает media_id (составной), не media_pk (числовой)
            cl.media_like(data.media_id)

            debug_info = {
                "instagram_request": {"method": "media_like", "media_id": data.media_id},
                # last_json содержит ответ Instagram на запрос лайка
                "instagram_response": _instagram_response_debug(getattr(cl, "last_json", None)),
            }

            return MediaLikeResponse(success=True, debug_info=debug_info)
        except Exception as e:
            code = error_to_code(e)
            return JSONResponse(
                status_code=error_to_http_status(code),
                content=MediaLikeResponse(success=False, error=str(e), error_code=code).model_dump(),
            )

    async with account_lock(data.session_data):
        return await asyncio.to_thread(_run)


@app.post("/media/comment")
async def comment_media(data: CommentRequest):
    """
    Оставляет текстовый комментарий к посту.

    Возвращает comment_pk — числовой id созданного комментария.
    Laravel сохраняет его в лог для последующей проверки или удаления.

    text передаётся как есть — генерация текста происходит на стороне Laravel
    через GenerateCommentJob (LLM).
    """
    def _run():
        try:
            cl = _make_client(data.session_data)

            # media_comment возвращает объект Comment с полем pk
            comment = cl.media_comment(data.media_id, data.text)

            debug_info = {
                "instagram_request": {
                    "method": "media_comment",
                    "media_id": data.media_id,
                    # Логируем текст для отладки — в продакшене можно убрать
                    "text": data.text,
                },
                "instagram_response": _instagram_response_debug(getattr(cl, "last_json", None)),
            }

            return CommentResponse(success=True, comment_pk=str(comment.pk), debug_info=debug_info)
        except Exception as e:
            code = error_to_code(e)
            return JSONResponse(
                status_code=error_to_http_status(code),
                content=CommentResponse(success=False, error=str(e), error_code=code).model_dump(),
            )

    async with account_lock(data.session_data):
        return await asyncio.to_thread(_run)


# ─── User ─────────────────────────────────────────────────────────────────────

@app.post("/user/info")
async def get_user_info_by_pk(data: UserInfoByPkRequest):
    """
    Возвращает публичный профиль пользователя Instagram по числовому user_pk.

    user_pk — числовой идентификатор пользователя (не username).
    Используется для открытия профиля при клике на автора поста в ленте.

    Поля biography и external_url могут отсутствовать у приватных аккаунтов —
    получаем через getattr с дефолтным значением.
    """
    def _run():
        try:
            cl = _make_client(data.session_data)

            # user_info принимает int, хотя приходит как строка из JSON
            user = cl.user_info(int(data.user_pk))

            return UserInfoByPkResponse(
                success=True,
                user={
                    "pk": str(user.pk),
                    "username": user.username,
                    "full_name": user.full_name,
                    # profile_pic_url — объект HttpUrl, приводим к строке
                    "profile_pic_url": str(user.profile_pic_url) if user.profile_pic_url else None,
                    # biography может отсутствовать в модели instagrapi
                    "biography": getattr(user, "biography", ""),
                    # external_url — ссылка в шапке профиля, часто пустая
                    "external_url": str(user.external_url) if getattr(user, "external_url", None) else None,
                    "is_private": user.is_private,
                    "is_verified": getattr(user, "is_verified", False),
                    "media_count": getattr(user, "media_count", 0),
                    "follower_count": getattr(user, "follower_count", 0),
                    "following_count": getattr(user, "following_count", 0),
                },
            )
        except Exception as e:
            code = error_to_code(e)
            return JSONResponse(
                status_code=error_to_http_status(code),
                content=UserInfoByPkResponse(success=False, error=str(e), error_code=code).model_dump(),
            )

    async with account_lock(data.session_data):
        return await asyncio.to_thread(_run)


# ─── Search ───────────────────────────────────────────────────────────────────

@app.post("/search/hashtag")
async def search_hashtag(data: SearchHashtagRequest):
    """
    Ищет посты по хэштегу через Instagram Private API (tags/{hashtag}/sections/).

    Использует sections-формат (не медиа-список), где посты сгруппированы
    по секциям с разными layout_type. Курсор пагинации — JSON-строка,
    собираемая из next_max_id + next_page + next_media_ids.

    При первом запросе возвращает amount постов.
    При пагинации (next_max_id передан) amount игнорируется.

    with_signature=False — для tags-эндпоинта Instagram не требует подписи запроса.
    """
    def _run():
        try:
            cl = _make_client(data.session_data)

            base_data = {
                # Показывать свежие посты среди топовых
                "media_recency_filter": "top_recent_posts",
                "_uuid": cl.uuid,
                "include_persistent": "false",
                # rank_token нужен для консистентности выдачи в рамках сессии
                "rank_token": cl.rank_token,
            }

            # При пагинации amount игнорируем — возвращаем всё, что есть на странице
            amount = data.amount if not data.next_max_id else None

            # URL-кодируем хэштег для корректной передачи кириллицы и спецсимволов
            ig_endpoint = f"tags/{quote(data.hashtag, safe='')}/sections/"

            items, cursor = _fetch_sections(
                cl, ig_endpoint, base_data, data.next_max_id, amount, with_signature=False
            )

            debug_info = {
                "instagram_request": {
                    "method": "private_request",
                    "endpoint": ig_endpoint,
                    "hashtag": data.hashtag,
                    "amount": data.amount,
                    "is_pagination": bool(data.next_max_id),
                },
                "instagram_response": _instagram_response_debug(getattr(cl, "last_json", None)),
            }

            return SearchResponse(success=True, items=items, next_max_id=cursor, debug_info=debug_info)
        except Exception as e:
            code = error_to_code(e)
            return JSONResponse(
                status_code=error_to_http_status(code),
                content=SearchResponse(success=False, error=str(e), error_code=code).model_dump(),
            )

    async with account_lock(data.session_data):
        return await asyncio.to_thread(_run)


@app.post("/search/locations")
async def search_locations(data: SearchLocationsRequest):
    """
    Ищет геолокации по текстовому запросу через Facebook Places Search.

    Возвращает список мест с pk, name, address, lat, lng.
    pk (location_pk) используется для последующего запроса постов
    по конкретной геолокации через /search/location.

    fbsearch_places — обёртка instagrapi над Facebook Graph API.
    """
    def _run():
        try:
            cl = _make_client(data.session_data)
            places = cl.fbsearch_places(data.query)

            # Нормализуем результаты — поля могут быть None у некоторых мест
            locations = []
            for place in places:
                locations.append({
                    "pk": int(place.pk),
                    "name": place.name or "",
                    "address": getattr(place, "address", "") or "",
                    # lat/lng могут быть None — приводим к 0.0 через or
                    "lat": float(getattr(place, "lat", 0.0) or 0.0),
                    "lng": float(getattr(place, "lng", 0.0) or 0.0),
                })

            debug_info = {
                "instagram_request": {"method": "fbsearch_places", "query": data.query},
                # fbsearch_places не сохраняет last_json — формируем вручную
                "instagram_response": {"status": "ok", "results_count": len(locations)},
            }

            return SearchLocationsResponse(success=True, locations=locations, debug_info=debug_info)
        except Exception as e:
            code = error_to_code(e)
            return JSONResponse(
                status_code=error_to_http_status(code),
                content=SearchLocationsResponse(success=False, error=str(e), error_code=code).model_dump(),
            )

    async with account_lock(data.session_data):
        return await asyncio.to_thread(_run)


@app.post("/media/comments")
async def fetch_media_comments(data: FetchCommentsRequest):
    """
    Загружает корневые комментарии к посту с поддержкой пагинации.

    Использует приватный эндпоинт Instagram с threading-режимом:
    каждый комментарий содержит child_comment_count и preview_child_comments.
    Курсор пагинации — next_min_id (не max_id!), движение от новых к старым.
    """
    def _run():
        try:
            cl = _make_client(data.session_data)

            params = {"can_support_threading": "true"}
            if data.min_id:
                params["min_id"] = data.min_id

            result = cl.private_request(
                f"media/{data.media_pk}/comments/",
                params=params,
            )

            comments = [_serialize_comment(raw) for raw in (result.get("comments") or [])]

            next_min_id = None
            if result.get("has_more_headload_comments"):
                next_min_id = result.get("next_min_id")

            return FetchCommentsResponse(
                success=True,
                comments=comments,
                next_min_id=next_min_id,
                comment_count=result.get("comment_count", 0),
            )
        except Exception as e:
            code = error_to_code(e)
            return JSONResponse(
                status_code=error_to_http_status(code),
                content={"success": False, "error": str(e), "error_code": code},
            )

    async with account_lock(data.session_data):
        return await asyncio.to_thread(_run)


@app.post("/media/comments/replies")
async def fetch_comment_replies(data: FetchCommentRepliesRequest):
    """
    Загружает дочерние комментарии (replies) конкретного комментария.
    Курсор пагинации — next_max_child_cursor.
    """
    def _run():
        try:
            cl = _make_client(data.session_data)

            params = {}
            if data.min_id:
                params["min_id"] = data.min_id

            result = cl.private_request(
                f"media/{data.media_pk}/comments/{data.comment_pk}/child_comments/",
                params=params,
            )

            child_comments = [_serialize_comment(raw) for raw in (result.get("child_comments") or [])]

            next_min_id = None
            if result.get("has_more_tail_child_comments"):
                next_min_id = result.get("next_max_child_cursor")

            return FetchCommentRepliesResponse(
                success=True,
                child_comments=child_comments,
                next_min_id=next_min_id,
                child_comment_count=result.get("child_comment_count", 0),
            )
        except Exception as e:
            code = error_to_code(e)
            return JSONResponse(
                status_code=error_to_http_status(code),
                content={"success": False, "error": str(e), "error_code": code},
            )

    async with account_lock(data.session_data):
        return await asyncio.to_thread(_run)


@app.post("/search/location", response_model=SearchResponse)
async def search_location_medias(data: SearchLocationRequest):
    """
    Возвращает посты по конкретной геолокации через locations/{pk}/sections/.

    Аналогичен /search/hashtag по структуре: sections-формат, cursor-пагинация.
    tab=recent — сортировка по новизне (альтернатива: ranked).

    location_pk — числовой id места из /search/locations.
    """
    def _run():
        try:
            cl = _make_client(data.session_data)

            base_data = {
                "_uuid": cl.uuid,
                "session_id": cl.client_session_id,
                # Показываем свежие посты, не топовые
                "tab": "recent",
            }

            # При пагинации amount игнорируем — возвращаем всё, что есть на странице
            amount = data.amount if not data.next_max_id else None
            ig_endpoint = f"locations/{data.location_pk}/sections/"

            # with_signature=True по умолчанию — locations-эндпоинт требует подписи
            items, cursor = _fetch_sections(cl, ig_endpoint, base_data, data.next_max_id, amount)

            debug_info = {
                "instagram_request": {
                    "method": "private_request",
                    "endpoint": ig_endpoint,
                    "location_pk": data.location_pk,
                    "amount": data.amount,
                    "is_pagination": bool(data.next_max_id),
                },
                "instagram_response": _instagram_response_debug(getattr(cl, "last_json", None)),
            }

            return SearchResponse(success=True, items=items, next_max_id=cursor, debug_info=debug_info)
        except Exception as e:
            code = error_to_code(e)
            return JSONResponse(
                status_code=error_to_http_status(code),
                content=SearchResponse(success=False, error=str(e), error_code=code).model_dump(),
            )

    async with account_lock(data.session_data):
        return await asyncio.to_thread(_run)
