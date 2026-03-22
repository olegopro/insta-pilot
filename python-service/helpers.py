import datetime
import json
import random
import time
from typing import Optional

from instagrapi import Client


# ─── Feed pagination helpers ───────────────────────────────────────────────────

def _build_view_info(media_id: str) -> dict:
    """
    Формирует элемент feed_view_info для одного поста.
    Имитирует случайное время просмотра — требуется Instagram при пагинации ленты.
    """
    view_ms = random.randint(5000, 15000)
    return {
        "media_id": media_id,
        "version": 23,
        "media_pct": 1.0,
        # Одно значение на все пороговые проценты просмотра
        "time_info": {"10": view_ms, "25": view_ms, "50": view_ms, "75": view_ms},
        "latest_timestamp": int(time.time() * 1000),
    }


def _build_pagination_params(cl: Client, max_id: str, seen_posts: list[str]) -> dict:
    """
    Собирает тело запроса для POST feed/timeline/ при пагинации.
    seen_posts и feed_view_info — ключевые поля, без них Instagram
    не знает контекст и возвращает дублирующиеся посты.
    """
    return {
        "max_id": max_id,
        "reason": "pagination",
        "is_pull_to_refresh": "0",
        "is_prefetch": "0",
        # Накопленные данные о просмотре предыдущих постов
        "feed_view_info": json.dumps([_build_view_info(media_id) for media_id in seen_posts]),
        "seen_posts": ",".join(seen_posts),
        # Идентификаторы устройства и сессии клиента
        "phone_id": cl.phone_id,
        "device_id": cl.uuid,
        "_uuid": cl.uuid,
        "_csrftoken": cl.token,
        "client_session_id": cl.client_session_id,
        # Состояние устройства (для аутентичности запроса)
        "battery_level": 100,
        "timezone_offset": cl.timezone_offset,
        "is_charging": "1",
        "will_sound_on": "0",
        # Параметры рекламного движка — отключены
        "is_async_ads_in_headload_enabled": "0",
        "is_async_ads_double_request": "0",
        "is_async_ads_rti": "0",
        "rti_delivery_backend": "0",
    }


# ─── Media serialization ──────────────────────────────────────────────────────

def _serialize_media(media_dict: dict) -> Optional[dict]:
    """
    Нормализует сырой медиа-объект Instagram API в единый формат.

    Поддерживаемые типы:
      1 — фото
      2 — видео
      8 — карусель (resources содержит вложенные элементы)
    """
    if not media_dict:
        return None

    media_type = media_dict.get("media_type", 1)

    # Thumbnail — первый кандидат из image_versions2
    candidates = (media_dict.get("image_versions2") or {}).get("candidates") or []
    thumbnail_url = candidates[0]["url"] if candidates else None

    # video_url — только для видео (media_type == 2)
    video_url = None
    if media_type == 2:
        versions = media_dict.get("video_versions") or []
        if versions:
            video_url = versions[0]["url"]

    # Элементы карусели (media_type == 8)
    resources = []
    if media_type == 8:
        for res in (media_dict.get("carousel_media") or []):
            res_type = res.get("media_type", 1)
            res_cands = (res.get("image_versions2") or {}).get("candidates") or []
            res_thumb = res_cands[0]["url"] if res_cands else None

            res_video = None
            if res_type == 2:
                res_vids = res.get("video_versions") or []
                if res_vids:
                    res_video = res_vids[0]["url"]

            resources.append({
                "pk": str(res.get("pk", "")),
                "media_type": res_type,
                "thumbnail_url": res_thumb,
                "video_url": res_video,
                "width": res.get("original_width"),
                "height": res.get("original_height"),
            })

    caption = media_dict.get("caption") or {}
    caption_text = caption.get("text", "") if isinstance(caption, dict) else ""

    user = media_dict.get("user") or {}

    # taken_at хранится как unix timestamp → ISO 8601 UTC
    taken_at_raw = media_dict.get("taken_at", 0)
    taken_at = (
        datetime.datetime.fromtimestamp(taken_at_raw, tz=datetime.timezone.utc).isoformat()
        if taken_at_raw else ""
    )

    location = media_dict.get("location") or {}

    return {
        "pk": str(media_dict.get("pk", "")),
        "id": str(media_dict.get("id", "")),
        "code": media_dict.get("code", ""),
        "taken_at": taken_at,
        "media_type": media_type,
        "thumbnail_url": thumbnail_url,
        "video_url": video_url,
        "caption_text": caption_text,
        "like_count": media_dict.get("like_count", 0),
        "comment_count": media_dict.get("comment_count", 0),
        # view_count — у видео называется view_count_at_producer или play_count
        "view_count": media_dict.get("view_count_at_producer") or media_dict.get("play_count") or 0,
        "has_liked": bool(media_dict.get("has_liked", False)),
        "user": {
            "pk": str(user.get("pk", "")),
            "username": user.get("username", ""),
            "full_name": user.get("full_name", ""),
            "profile_pic_url": user.get("profile_pic_url"),
        },
        "resources": resources,
        "location_name": location.get("name") if isinstance(location, dict) else None,
        "location_pk": location.get("pk") if isinstance(location, dict) else None,
        "thumbnail_width": media_dict.get("original_width"),
        "thumbnail_height": media_dict.get("original_height"),
        # Размеры видео совпадают с оригинальными только для видео-постов
        "video_width": media_dict.get("original_width") if media_type == 2 else None,
        "video_height": media_dict.get("original_height") if media_type == 2 else None,
    }


# ─── Comment serialization ────────────────────────────────────────────────────

def _serialize_comment(raw: dict) -> dict:
    """
    Нормализует raw-комментарий Instagram API в единый формат.
    Рекурсивно сериализует preview_child_comments.
    """
    user = raw.get("user") or {}
    created_at_raw = raw.get("created_at_utc") or raw.get("created_at", 0)
    created_at = (
        datetime.datetime.fromtimestamp(created_at_raw, tz=datetime.timezone.utc).isoformat()
        if isinstance(created_at_raw, (int, float)) and created_at_raw
        else str(created_at_raw)
    )

    preview_children = [
        _serialize_comment(child)
        for child in (raw.get("preview_child_comments") or [])
    ]

    return {
        "pk": str(raw.get("pk", "")),
        "text": raw.get("text", ""),
        "created_at_utc": created_at,
        "like_count": raw.get("comment_like_count", 0),
        "has_liked": bool(raw.get("has_liked_comment", False)),
        "replied_to_comment_id": str(raw["replied_to_comment_id"]) if raw.get("replied_to_comment_id") else None,
        "child_comment_count": raw.get("child_comment_count", 0),
        "user": {
            "pk": str(user.get("pk", "")),
            "username": user.get("username", ""),
            "full_name": user.get("full_name", ""),
            "profile_pic_url": user.get("profile_pic_url"),
        },
        "preview_child_comments": preview_children,
    }


# ─── Debug ────────────────────────────────────────────────────────────────────

def _instagram_response_debug(raw: Optional[dict]) -> dict:
    """
    Компактное представление raw-ответа Instagram для логирования.
    Убирает большие массивы постов, оставляя только счётчики и превью pk.
    """
    if not raw:
        return {}

    result: dict = {"status": raw.get("status")}

    # Лента (feed/timeline/) — содержит feed_items
    if "feed_items" in raw:
        feed_items = raw.get("feed_items") or []
        result["feed_items_count"] = len(feed_items)
        result["more_available"] = raw.get("more_available")
        result["has_next_max_id"] = bool(raw.get("next_max_id"))
        # Первые 5 pk постов — для ориентира без лишнего объёма
        result["items_preview"] = [
            str((item.get("media_or_ad") or {}).get("pk", ""))
            for item in feed_items[:5]
            if (item.get("media_or_ad") or {}).get("pk")
        ]
        return result

    # Поиск по хэштегу или геолокации — содержит sections
    if "sections" in raw:
        sections = raw.get("sections") or []
        result["sections_count"] = len(sections)
        result["more_available"] = raw.get("more_available")
        result["has_next_max_id"] = bool(raw.get("next_max_id"))
        # Первые 3 секции с количеством и pk медиа
        result["sections_preview"] = [
            {
                "layout_type": s.get("layout_type"),
                "medias_count": len((s.get("layout_content") or {}).get("medias") or []),
                "media_pks": [
                    str((m.get("media") or {}).get("pk", ""))
                    for m in ((s.get("layout_content") or {}).get("medias") or [])
                    if (m.get("media") or {}).get("pk")
                ],
            }
            for s in sections[:3]
        ]
        return result

    # Ответ на создание комментария
    if "comment" in raw:
        c = raw.get("comment") or {}
        result["comment"] = {
            "pk": str(c.get("pk", "")),
            "text": c.get("text", ""),
            "created_at": c.get("created_at"),
        }
        return result

    # Для всех остальных ответов — возвращаем как есть
    return raw


# ─── Feed extraction & pagination ─────────────────────────────────────────────

def _extract_posts(raw: dict) -> list[dict]:
    """Извлекает и сериализует посты из feed_items ленты."""
    posts = []
    for item in (raw.get("feed_items") or []):
        media_dict = item.get("media_or_ad") or {}
        serialized = _serialize_media(media_dict)
        if serialized and serialized["pk"]:
            posts.append(serialized)
    return posts


# Максимальное число итераций пагинации за один вызов (защита от бесконечного цикла)
MAX_PAGINATION_ITERATIONS = 5


def _paginate_feed(
    cl: Client,
    start_max_id: str,
    seen: list[str],
    all_posts: list[dict],
    min_posts: Optional[int],
    label: str,
) -> tuple[Optional[str], bool]:
    """
    Последовательно запрашивает страницы ленты через POST feed/timeline/.

    Останавливается при первом из условий:
      - достигнут min_posts
      - лента закончилась (more_available=False)
      - исчерпан лимит MAX_PAGINATION_ITERATIONS

    Мутирует all_posts и seen на месте.
    Возвращает (next_max_id, more_available) после последней итерации.
    """
    current_max_id = start_max_id
    next_max_id = None
    more_available = True
    iterations = 0

    while more_available and iterations < MAX_PAGINATION_ITERATIONS:
        iterations += 1

        params = _build_pagination_params(cl, current_max_id, seen)
        raw = cl.private_request("feed/timeline/", data=params, with_signature=False)

        batch = _extract_posts(raw)
        all_posts.extend(batch)
        seen.extend([p["id"] for p in batch])

        next_max_id = raw.get("next_max_id")
        more_available = bool(raw.get("more_available", False)) and bool(next_max_id)

        print(f"[FEED] {label} iteration={iterations}, batch={len(batch)}, total={len(all_posts)}, more={'yes' if more_available else 'no'}")

        if not min_posts or len(all_posts) >= min_posts or not more_available:
            break

        current_max_id = next_max_id
        # Пауза между запросами — снижает вероятность rate-limit
        time.sleep(random.uniform(1.0, 2.5))

    return next_max_id, more_available


# ─── Sections extraction & pagination ─────────────────────────────────────────

def _extract_sections_posts(raw: dict, amount: Optional[int] = None) -> list[dict]:
    """
    Извлекает и сериализует посты из sections-ответа
    (используется для хэштегов и геолокаций).
    Если передан amount — обрезает выдачу до нужного числа.
    """
    posts = []
    for section in (raw.get("sections") or []):
        nodes = (section.get("layout_content") or {}).get("medias") or []
        for node in nodes:
            if amount is not None and len(posts) >= amount:
                break
            serialized = _serialize_media(node.get("media") or {})
            if serialized and serialized["pk"]:
                posts.append(serialized)

        if amount is not None and len(posts) >= amount:
            break

    return posts


def _build_sections_cursor(raw: dict) -> Optional[str]:
    """
    Собирает JSON-курсор для следующей страницы sections.
    Возвращает None, если данных больше нет (more_available=False или нет next_max_id).
    """
    next_max_id = raw.get("next_max_id")
    if not next_max_id or not raw.get("more_available"):
        return None

    return json.dumps({
        "max_id": next_max_id,
        "page": raw.get("next_page"),
        "media_ids": raw.get("next_media_ids") or [],
    })


def _parse_sections_cursor(cursor: str) -> dict:
    """Разбирает JSON-курсор и возвращает параметры для следующего запроса."""
    data = json.loads(cursor)
    params: dict = {"max_id": data["max_id"]}
    if data.get("page") is not None:
        params["page"] = data["page"]
    if data.get("media_ids"):
        params["media_ids"] = ",".join(str(m) for m in data["media_ids"])
    return params


def _fetch_sections(
    cl: Client,
    endpoint: str,
    base_data: dict,
    next_cursor: Optional[str],
    amount: Optional[int],
    with_signature: bool = True,
) -> tuple[list[dict], Optional[str]]:
    """
    Выполняет один запрос к sections-эндпоинту (хэштег или геолокация).
    Если передан next_cursor — добавляет параметры пагинации поверх base_data.
    Возвращает (posts, cursor_для_следующей_страницы).
    """
    data = {**base_data}
    if next_cursor:
        data.update(_parse_sections_cursor(next_cursor))

    raw = cl.private_request(endpoint, data=data, with_signature=with_signature)
    posts = _extract_sections_posts(raw, amount)
    cursor = _build_sections_cursor(raw)

    return posts, cursor
