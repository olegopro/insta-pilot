import datetime
import hashlib
import json
import random
import time
from typing import Optional, List
from urllib.parse import quote

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from instagrapi import Client

from utils import error_to_code, error_to_http_status

app = FastAPI(title="insta-pilot python service")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _build_view_info(media_id: str) -> dict:
    view_ms = random.randint(5000, 15000)
    return {
        "media_id": media_id,
        "version": 23,
        "media_pct": 1.0,
        "time_info": {"10": view_ms, "25": view_ms, "50": view_ms, "75": view_ms},
        "latest_timestamp": int(time.time() * 1000),
    }


def _build_pagination_params(cl: Client, max_id: str, seen_posts: list[str]) -> dict:
    return {
        "max_id": max_id,
        "reason": "pagination",
        "is_pull_to_refresh": "0",
        "is_prefetch": "0",
        "feed_view_info": json.dumps([_build_view_info(media_id) for media_id in seen_posts]),
        "seen_posts": ",".join(seen_posts),
        "phone_id": cl.phone_id,
        "device_id": cl.uuid,
        "_uuid": cl.uuid,
        "_csrftoken": cl.token,
        "client_session_id": cl.client_session_id,
        "battery_level": 100,
        "timezone_offset": cl.timezone_offset,
        "is_charging": "1",
        "will_sound_on": "0",
        "is_async_ads_in_headload_enabled": "0",
        "is_async_ads_double_request": "0",
        "is_async_ads_rti": "0",
        "rti_delivery_backend": "0",
    }


_client_cache: dict[str, tuple[Client, float]] = {}
_CLIENT_CACHE_TTL = 300
_CLIENT_CACHE_MAX = 5


def _make_client(session_data: str, proxy: Optional[str] = None) -> Client:
    cache_key = hashlib.md5(session_data.encode()).hexdigest()
    now = time.time()

    if cache_key in _client_cache:
        cl, created_at = _client_cache[cache_key]
        if now - created_at < _CLIENT_CACHE_TTL:
            return cl
        del _client_cache[cache_key]

    if len(_client_cache) >= _CLIENT_CACHE_MAX:
        oldest_key = min(_client_cache, key=lambda k: _client_cache[k][1])
        del _client_cache[oldest_key]

    cl = Client()
    if proxy:
        cl.set_proxy(proxy)
    settings = json.loads(session_data)
    cl.set_settings(settings)
    _client_cache[cache_key] = (cl, now)
    return cl


def _serialize_media(media_dict: dict) -> Optional[dict]:
    if not media_dict:
        return None

    media_type = media_dict.get("media_type", 1)

    candidates = (media_dict.get("image_versions2") or {}).get("candidates") or []
    thumbnail_url = candidates[0]["url"] if candidates else None

    video_url = None
    if media_type == 2:
        versions = media_dict.get("video_versions") or []
        if versions:
            video_url = versions[0]["url"]

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
                "height": res.get("original_height")
            })

    caption = media_dict.get("caption") or {}
    caption_text = caption.get("text", "") if isinstance(caption, dict) else ""

    user = media_dict.get("user") or {}

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
        "view_count": media_dict.get("view_count_at_producer") or media_dict.get("play_count") or 0,
        "has_liked": bool(media_dict.get("has_liked", False)),
        "user": {
            "pk": str(user.get("pk", "")),
            "username": user.get("username", ""),
            "full_name": user.get("full_name", ""),
            "profile_pic_url": user.get("profile_pic_url")
        },
        "resources": resources,
        "location_name": location.get("name") if isinstance(location, dict) else None,
        "thumbnail_width": media_dict.get("original_width"),
        "thumbnail_height": media_dict.get("original_height"),
        "video_width": media_dict.get("original_width") if media_type == 2 else None,
        "video_height": media_dict.get("original_height") if media_type == 2 else None
    }


# ─── Models ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    login: str
    password: str
    proxy: Optional[str] = None
    device_profile: Optional[dict] = None


class LoginResponse(BaseModel):
    success: bool
    session_data: Optional[str] = None
    full_name: Optional[str] = None
    profile_pic_url: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


class SessionRequest(BaseModel):
    session_data: str


class AccountInfoResponse(BaseModel):
    success: bool
    followers_count: Optional[int] = None
    following_count: Optional[int] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


class MediaLikeRequest(SessionRequest):
    media_id: str


class MediaLikeResponse(BaseModel):
    success: bool
    error: Optional[str] = None
    error_code: Optional[str] = None
    debug_info: Optional[dict] = None


class FeedRequest(SessionRequest):
    max_id: Optional[str] = None
    seen_posts: Optional[str] = None
    reason: Optional[str] = None
    min_posts: Optional[int] = None


class FeedResponse(BaseModel):
    success: bool
    posts: List[dict] = []
    next_max_id: Optional[str] = None
    more_available: bool = False
    error: Optional[str] = None
    error_code: Optional[str] = None
    debug_info: Optional[dict] = None


class UserInfoByPkRequest(SessionRequest):
    user_pk: str


class UserInfoByPkResponse(BaseModel):
    success: bool
    user: Optional[dict] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


class SearchHashtagRequest(SessionRequest):
    hashtag: str
    amount: int = 30
    next_max_id: Optional[str] = None


class SearchLocationsRequest(SessionRequest):
    query: str


class SearchLocationRequest(SessionRequest):
    location_pk: int
    amount: int = 30
    next_max_id: Optional[str] = None


class SearchResponse(BaseModel):
    success: bool
    items: List[dict] = []
    next_max_id: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    debug_info: Optional[dict] = None


class SearchLocationsResponse(BaseModel):
    success: bool
    locations: List[dict] = []
    error: Optional[str] = None
    error_code: Optional[str] = None
    debug_info: Optional[dict] = None


class CommentRequest(SessionRequest):
    media_id: str
    text: str


class CommentResponse(BaseModel):
    success: bool
    comment_pk: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    debug_info: Optional[dict] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/login")
async def login(data: LoginRequest):
    try:
        cl = Client()
        if data.proxy:
            cl.set_proxy(data.proxy)
        if data.device_profile:
            device_settings = data.device_profile.get("device_settings")
            user_agent = data.device_profile.get("user_agent")
            if isinstance(device_settings, dict):
                cl.set_device(device_settings)
            if isinstance(user_agent, str) and user_agent:
                cl.set_user_agent(user_agent)
        cl.login(data.login, data.password)
        session_data = json.dumps(cl.get_settings())
        user_info = cl.account_info()
        return LoginResponse(
            success=True,
            session_data=session_data,
            full_name=user_info.full_name,
            profile_pic_url=str(user_info.profile_pic_url)
        )
    except Exception as e:
        code = error_to_code(e)
        return JSONResponse(
            status_code=error_to_http_status(code),
            content=LoginResponse(success=False, error=str(e), error_code=code).model_dump()
        )


@app.post("/account/info")
async def account_info(data: SessionRequest):
    try:
        cl = _make_client(data.session_data)
        info = cl.account_info()
        return AccountInfoResponse(
            success=True,
            followers_count=info.follower_count,
            following_count=info.following_count
        )
    except Exception as e:
        code = error_to_code(e)
        return JSONResponse(
            status_code=error_to_http_status(code),
            content=AccountInfoResponse(success=False, error=str(e), error_code=code).model_dump()
        )


@app.post("/media/like")
async def like_media(data: MediaLikeRequest):
    try:
        cl = _make_client(data.session_data)
        cl.media_like(data.media_id)
        debug_info = {
            "instagram_request": {"method": "media_like", "media_id": data.media_id},
            "instagram_response": _instagram_response_debug(getattr(cl, "last_json", None)),
        }
        return MediaLikeResponse(success=True, debug_info=debug_info)
    except Exception as e:
        code = error_to_code(e)
        return JSONResponse(
            status_code=error_to_http_status(code),
            content=MediaLikeResponse(success=False, error=str(e), error_code=code).model_dump()
        )


def _instagram_response_debug(raw: Optional[dict]) -> dict:
    """Compact debug representation of an Instagram API response (strips large post arrays)."""
    if not raw:
        return {}

    result: dict = {"status": raw.get("status")}

    if "feed_items" in raw:
        feed_items = raw.get("feed_items") or []
        result["feed_items_count"] = len(feed_items)
        result["more_available"] = raw.get("more_available")
        result["has_next_max_id"] = bool(raw.get("next_max_id"))
        result["items_preview"] = [
            str((item.get("media_or_ad") or {}).get("pk", ""))
            for item in feed_items[:5]
            if (item.get("media_or_ad") or {}).get("pk")
        ]
        return result

    if "sections" in raw:
        sections = raw.get("sections") or []
        result["sections_count"] = len(sections)
        result["more_available"] = raw.get("more_available")
        result["has_next_max_id"] = bool(raw.get("next_max_id"))
        result["sections_preview"] = [
            {
                "layout_type": s.get("layout_type"),
                "medias_count": len((s.get("layout_content") or {}).get("medias") or []),
                "media_pks": [
                    str((m.get("media") or {}).get("pk", ""))
                    for m in ((s.get("layout_content") or {}).get("medias") or [])
                    if (m.get("media") or {}).get("pk")
                ]
            }
            for s in sections[:3]
        ]
        return result

    if "comment" in raw:
        c = raw.get("comment") or {}
        result["comment"] = {
            "pk": str(c.get("pk", "")),
            "text": c.get("text", ""),
            "created_at": c.get("created_at"),
        }
        return result

    return raw


def _extract_posts(raw: dict) -> list[dict]:
    feed_items = raw.get("feed_items") or []
    posts = []
    for item in feed_items:
        media_dict = item.get("media_or_ad") or {}
        serialized = _serialize_media(media_dict)
        if serialized and serialized["pk"]:
            posts.append(serialized)
    return posts


MAX_PAGINATION_ITERATIONS = 5


def _paginate_feed(
    cl: Client,
    start_max_id: str,
    seen: list[str],
    all_posts: list[dict],
    min_posts: Optional[int],
    label: str
) -> tuple[Optional[str], bool]:
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
        time.sleep(random.uniform(1.0, 2.5))

    return next_max_id, more_available


@app.post("/account/feed", response_model=FeedResponse)
async def get_feed(data: FeedRequest):
    try:
        cl = _make_client(data.session_data)

        if data.max_id:
            seen = [s for s in (data.seen_posts or "").split(",") if s]
            all_posts: list[dict] = []

            next_max_id, more_available = _paginate_feed(
                cl, data.max_id, seen, all_posts, data.min_posts, "pagination"
            )

            debug_info = {
                "instagram_request": {
                    "method": "feed/timeline/ (pagination)",
                    "max_id": data.max_id,
                    "seen_posts_count": len(seen),
                },
                "instagram_response": _instagram_response_debug(getattr(cl, "last_json", None)),
            }

            return FeedResponse(
                success=True,
                posts=all_posts,
                next_max_id=next_max_id,
                more_available=more_available,
                debug_info=debug_info,
            )
        else:
            reason = data.reason if data.reason in ("cold_start_fetch", "pull_to_refresh", "warm_start_fetch") else "cold_start_fetch"
            raw = cl.get_timeline_feed(reason)
            all_posts = _extract_posts(raw)
            next_max_id = raw.get("next_max_id")
            more_available = bool(raw.get("more_available", False)) and bool(next_max_id)
            seen = [p["id"] for p in all_posts]

            print(f"[FEED] initial={len(all_posts)}, next_max_id={'yes' if next_max_id else 'no'}")

            if data.min_posts and len(all_posts) < data.min_posts and more_available:
                next_max_id, more_available = _paginate_feed(
                    cl, next_max_id, seen, all_posts, data.min_posts, "extra"
                )

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
            content=FeedResponse(success=False, error=str(e), error_code=code).model_dump()
        )


def _extract_sections_posts(raw: dict, amount: Optional[int] = None) -> list[dict]:
    posts = []
    for section in raw.get("sections") or []:
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
    next_max_id = raw.get("next_max_id")
    if not next_max_id or not raw.get("more_available"):
        return None
    return json.dumps({
        "max_id": next_max_id,
        "page": raw.get("next_page"),
        "media_ids": raw.get("next_media_ids") or []
    })


def _parse_sections_cursor(cursor: str) -> dict:
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
    data = {**base_data}
    if next_cursor:
        data.update(_parse_sections_cursor(next_cursor))
    raw = cl.private_request(endpoint, data=data, with_signature=with_signature)
    posts = _extract_sections_posts(raw, amount)
    cursor = _build_sections_cursor(raw)
    return posts, cursor


@app.post("/user/info")
async def get_user_info_by_pk(data: UserInfoByPkRequest):
    try:
        cl = _make_client(data.session_data)
        user = cl.user_info(int(data.user_pk))
        return UserInfoByPkResponse(
            success=True,
            user={
                "pk": str(user.pk),
                "username": user.username,
                "full_name": user.full_name,
                "profile_pic_url": str(user.profile_pic_url) if user.profile_pic_url else None,
                "biography": getattr(user, "biography", ""),
                "external_url": str(user.external_url) if getattr(user, "external_url", None) else None,
                "is_private": user.is_private,
                "is_verified": getattr(user, "is_verified", False),
                "media_count": getattr(user, "media_count", 0),
                "follower_count": getattr(user, "follower_count", 0),
                "following_count": getattr(user, "following_count", 0)
            }
        )
    except Exception as e:
        code = error_to_code(e)
        return JSONResponse(
            status_code=error_to_http_status(code),
            content=UserInfoByPkResponse(success=False, error=str(e), error_code=code).model_dump()
        )


@app.post("/search/hashtag")
def search_hashtag(data: SearchHashtagRequest):
    try:
        cl = _make_client(data.session_data)
        base_data = {
            "media_recency_filter": "top_recent_posts",
            "_uuid": cl.uuid,
            "include_persistent": "false",
            "rank_token": cl.rank_token,
        }
        amount = data.amount if not data.next_max_id else None
        ig_endpoint = f"tags/{quote(data.hashtag, safe='')}/sections/"
        items, cursor = _fetch_sections(cl, ig_endpoint, base_data, data.next_max_id, amount, with_signature=False)
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
            content=SearchResponse(success=False, error=str(e), error_code=code).model_dump()
        )


@app.post("/search/locations")
def search_locations(data: SearchLocationsRequest):
    try:
        cl = _make_client(data.session_data)
        places = cl.fbsearch_places(data.query)
        locations = []
        for place in places:
            locations.append({
                "pk": int(place.pk),
                "name": place.name or "",
                "address": getattr(place, 'address', "") or "",
                "lat": float(getattr(place, 'lat', 0.0) or 0.0),
                "lng": float(getattr(place, 'lng', 0.0) or 0.0)
            })
        debug_info = {
            "instagram_request": {"method": "fbsearch_places", "query": data.query},
            "instagram_response": {
                "status": "ok",
                "results_count": len(locations),
            },
        }
        return SearchLocationsResponse(success=True, locations=locations, debug_info=debug_info)
    except Exception as e:
        code = error_to_code(e)
        return JSONResponse(
            status_code=error_to_http_status(code),
            content=SearchLocationsResponse(success=False, error=str(e), error_code=code).model_dump()
        )


@app.post("/search/location")
def search_location_medias(data: SearchLocationRequest):
    try:
        cl = _make_client(data.session_data)
        base_data = {
            "_uuid": cl.uuid,
            "session_id": cl.client_session_id,
            "tab": "recent",
        }
        amount = data.amount if not data.next_max_id else None
        ig_endpoint = f"locations/{data.location_pk}/sections/"
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
            content=SearchResponse(success=False, error=str(e), error_code=code).model_dump()
        )


@app.post("/media/comment")
def comment_media(data: CommentRequest):
    try:
        cl = _make_client(data.session_data)
        comment = cl.media_comment(data.media_id, data.text)
        debug_info = {
            "instagram_request": {
                "method": "media_comment",
                "media_id": data.media_id,
                "text": data.text,
            },
            "instagram_response": _instagram_response_debug(getattr(cl, "last_json", None)),
        }
        return CommentResponse(success=True, comment_pk=str(comment.pk), debug_info=debug_info)
    except Exception as e:
        code = error_to_code(e)
        return JSONResponse(
            status_code=error_to_http_status(code),
            content=CommentResponse(success=False, error=str(e), error_code=code).model_dump()
        )
