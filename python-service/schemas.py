from typing import Optional, List

from pydantic import BaseModel


# ─── Base ─────────────────────────────────────────────────────────────────────

class SessionRequest(BaseModel):
    """Базовая схема для всех запросов, требующих активной сессии."""
    session_data: str


# ─── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    login: str
    password: str
    # Профиль устройства (manufacturer, model, user_agent и др.)
    device_profile: Optional[dict] = None


class LoginResponse(BaseModel):
    success: bool
    session_data: Optional[str] = None
    full_name: Optional[str] = None
    profile_pic_url: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


# ─── Account ──────────────────────────────────────────────────────────────────

class AccountInfoResponse(BaseModel):
    success: bool
    user_pk: Optional[int] = None
    followers_count: Optional[int] = None
    following_count: Optional[int] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


# ─── Media ────────────────────────────────────────────────────────────────────

class MediaLikeRequest(SessionRequest):
    media_id: str


class MediaLikeResponse(BaseModel):
    success: bool
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


# ─── Feed ─────────────────────────────────────────────────────────────────────

class FeedRequest(SessionRequest):
    # При пагинации передаётся max_id из предыдущего ответа
    max_id: Optional[str] = None
    # Список id уже показанных постов (через запятую)
    seen_posts: Optional[str] = None
    # cold_start_fetch | pull_to_refresh | warm_start_fetch
    reason: Optional[str] = None
    # Минимальное число постов — при нехватке делает дополнительные запросы
    min_posts: Optional[int] = None


class FeedResponse(BaseModel):
    success: bool
    posts: List[dict] = []
    next_max_id: Optional[str] = None
    more_available: bool = False
    error: Optional[str] = None
    error_code: Optional[str] = None
    debug_info: Optional[dict] = None


# ─── User ─────────────────────────────────────────────────────────────────────

class UserInfoByPkRequest(SessionRequest):
    user_pk: str


class UserInfoByPkResponse(BaseModel):
    success: bool
    user: Optional[dict] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


# ─── Search ───────────────────────────────────────────────────────────────────

class SearchHashtagRequest(SessionRequest):
    hashtag: str
    amount: int = 30
    # Курсор пагинации (JSON-строка, собирается на нашей стороне)
    next_max_id: Optional[str] = None


class SearchLocationsRequest(SessionRequest):
    # Текстовый запрос для поиска геолокаций через fbsearch_places
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


# ─── Comments ─────────────────────────────────────────────────────────────────

class FetchCommentsRequest(SessionRequest):
    media_pk: str
    min_id: Optional[str] = None


class FetchCommentsResponse(BaseModel):
    success: bool
    comments: List[dict] = []
    next_min_id: Optional[str] = None
    comment_count: int = 0
    error: Optional[str] = None
    error_code: Optional[str] = None


class FetchCommentRepliesRequest(SessionRequest):
    media_pk: str
    comment_pk: str
    min_id: Optional[str] = None


class FetchCommentRepliesResponse(BaseModel):
    success: bool
    child_comments: List[dict] = []
    next_min_id: Optional[str] = None
    child_comment_count: int = 0
    error: Optional[str] = None
    error_code: Optional[str] = None
