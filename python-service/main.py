import datetime
import json
from typing import Optional, List

from fastapi import FastAPI
from pydantic import BaseModel
from instagrapi import Client

app = FastAPI(title="insta-pilot python service")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_client(session_data: str, proxy: Optional[str] = None) -> Client:
    cl = Client()
    if proxy:
        cl.set_proxy(proxy)
    settings = json.loads(session_data)
    cl.set_settings(settings)
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
                "video_url": res_video
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
        "location_name": location.get("name") if isinstance(location, dict) else None
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


class MediaLikeRequest(BaseModel):
    session_data: str
    media_id: str


class MediaLikeResponse(BaseModel):
    success: bool
    error: Optional[str] = None


class FeedRequest(BaseModel):
    session_data: str
    max_id: Optional[str] = None


class FeedResponse(BaseModel):
    success: bool
    posts: List[dict] = []
    next_max_id: Optional[str] = None
    more_available: bool = False
    error: Optional[str] = None


class UserInfoByPkRequest(BaseModel):
    session_data: str
    user_pk: str


class UserInfoByPkResponse(BaseModel):
    success: bool
    user: Optional[dict] = None
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


@app.post("/account/feed", response_model=FeedResponse)
async def get_feed(data: FeedRequest):
    try:
        cl = _make_client(data.session_data)
        raw = cl.get_timeline_feed(max_id=data.max_id)
        feed_items = raw.get("feed_items") or []
        posts = []
        for item in feed_items:
            media_dict = item.get("media_or_ad") or {}
            serialized = _serialize_media(media_dict)
            if serialized and serialized["pk"]:
                posts.append(serialized)
        return FeedResponse(
            success=True,
            posts=posts,
            next_max_id=raw.get("next_max_id"),
            more_available=bool(raw.get("more_available", False))
        )
    except Exception as e:
        return FeedResponse(success=False, error=str(e))


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
