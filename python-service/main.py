import datetime
import hashlib
import json
import random
import time
from typing import Optional, List
from urllib.parse import quote

from fastapi import FastAPI
from pydantic import BaseModel
from instagrapi import Client

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


class LoginResponse(BaseModel):
    success: bool
    session_data: Optional[str] = None
    full_name: Optional[str] = None
    profile_pic_url: Optional[str] = None
    error: Optional[str] = None


class SessionRequest(BaseModel):
    session_data: str


class AccountInfoResponse(BaseModel):
    success: bool
    followers_count: Optional[int] = None
    following_count: Optional[int] = None
    error: Optional[str] = None


class MediaLikeRequest(SessionRequest):
    media_id: str


class MediaLikeResponse(BaseModel):
    success: bool
    error: Optional[str] = None


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


class UserInfoByPkRequest(SessionRequest):
    user_pk: str


class UserInfoByPkResponse(BaseModel):
    success: bool
    user: Optional[dict] = None
    error: Optional[str] = None


class SearchHashtagRequest(SessionRequest):
    hashtag: str
    amount: int = 30


class SearchLocationsRequest(SessionRequest):
    query: str


class SearchLocationRequest(SessionRequest):
    location_pk: int
    amount: int = 30


class SearchResponse(BaseModel):
    success: bool
    items: List[dict] = []
    error: Optional[str] = None


class SearchLocationsResponse(BaseModel):
    success: bool
    locations: List[dict] = []
    error: Optional[str] = None


class CommentRequest(SessionRequest):
    media_id: str
    text: str


class CommentResponse(BaseModel):
    success: bool
    comment_pk: Optional[str] = None
    error: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/login", response_model=LoginResponse)
async def login(data: LoginRequest):
    try:
        cl = Client()
        if data.proxy:
            cl.set_proxy(data.proxy)
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
        return LoginResponse(success=False, error=str(e))


@app.post("/account/info", response_model=AccountInfoResponse)
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
        return AccountInfoResponse(success=False, error=str(e))


@app.post("/media/like", response_model=MediaLikeResponse)
async def like_media(data: MediaLikeRequest):
    try:
        cl = _make_client(data.session_data)
        cl.media_like(data.media_id)
        return MediaLikeResponse(success=True)
    except Exception as e:
        return MediaLikeResponse(success=False, error=str(e))


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

            return FeedResponse(
                success=True,
                posts=all_posts,
                next_max_id=next_max_id,
                more_available=more_available
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

            return FeedResponse(
                success=True,
                posts=all_posts,
                next_max_id=next_max_id,
                more_available=more_available
            )
    except Exception as e:
        return FeedResponse(success=False, error=str(e))


def _extract_sections_posts(raw: dict, amount: int) -> list[dict]:
    posts = []
    for section in raw.get("sections") or []:
        nodes = (section.get("layout_content") or {}).get("medias") or []
        for node in nodes:
            if len(posts) >= amount:
                break
            serialized = _serialize_media(node.get("media") or {})
            if serialized and serialized["pk"]:
                posts.append(serialized)
        if len(posts) >= amount:
            break
    return posts


@app.post("/user/info", response_model=UserInfoByPkResponse)
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
        return UserInfoByPkResponse(success=False, error=str(e))


@app.post("/search/hashtag", response_model=SearchResponse)
def search_hashtag(data: SearchHashtagRequest):
    try:
        cl = _make_client(data.session_data)
        raw = cl.private_request(
            f"tags/{quote(data.hashtag, safe='')}/sections/",
            data={
                "media_recency_filter": "top_recent_posts",
                "_uuid": cl.uuid,
                "include_persistent": "false",
                "rank_token": cl.rank_token,
            },
            with_signature=False,
        )
        return SearchResponse(success=True, items=_extract_sections_posts(raw, data.amount))
    except Exception as e:
        return SearchResponse(success=False, error=str(e))


@app.post("/search/locations", response_model=SearchLocationsResponse)
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
        return SearchLocationsResponse(success=True, locations=locations)
    except Exception as e:
        return SearchLocationsResponse(success=False, error=str(e))


@app.post("/search/location", response_model=SearchResponse)
def search_location_medias(data: SearchLocationRequest):
    try:
        cl = _make_client(data.session_data)
        raw = cl.private_request(
            f"locations/{data.location_pk}/sections/",
            data={
                "_uuid": cl.uuid,
                "session_id": cl.client_session_id,
                "tab": "recent",
            },
        )
        return SearchResponse(success=True, items=_extract_sections_posts(raw, data.amount))
    except Exception as e:
        return SearchResponse(success=False, error=str(e))


@app.post("/media/comment", response_model=CommentResponse)
def comment_media(data: CommentRequest):
    try:
        cl = _make_client(data.session_data)
        comment = cl.media_comment(data.media_id, data.text)
        return CommentResponse(success=True, comment_pk=str(comment.pk))
    except Exception as e:
        return CommentResponse(success=False, error=str(e))
