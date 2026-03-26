"""
Unit-тесты для schemas.py — валидация Pydantic-моделей.
"""

import pytest
from pydantic import ValidationError

from schemas import (
    AccountInfoResponse,
    CommentRequest,
    CommentResponse,
    FeedRequest,
    FeedResponse,
    FetchCommentRepliesRequest,
    FetchCommentsRequest,
    LoginRequest,
    LoginResponse,
    MediaLikeRequest,
    SearchHashtagRequest,
    SearchLocationRequest,
    SearchLocationsRequest,
    SearchResponse,
    SessionRequest,
    UserInfoByPkRequest,
)


class TestSessionRequest:
    def test_requires_session_data(self):
        with pytest.raises(ValidationError):
            SessionRequest()

    def test_valid(self):
        req = SessionRequest(session_data='{"key": "value"}')
        assert req.session_data == '{"key": "value"}'


class TestLoginRequest:
    def test_requires_login(self):
        with pytest.raises(ValidationError):
            LoginRequest(password="pass")

    def test_requires_password(self):
        with pytest.raises(ValidationError):
            LoginRequest(login="user")

    def test_valid_minimal(self):
        req = LoginRequest(login="user", password="pass")
        assert req.login == "user"
        assert req.password == "pass"
        assert req.device_profile is None

    def test_valid_with_device_profile(self):
        profile = {"device_settings": {"app_version": "269.0"}, "user_agent": "Instagram/269.0"}
        req = LoginRequest(login="user", password="pass", device_profile=profile)
        assert req.device_profile == profile


class TestFeedRequest:
    def test_requires_session_data(self):
        with pytest.raises(ValidationError):
            FeedRequest()

    def test_optional_fields_default_none(self):
        req = FeedRequest(session_data='{}')
        assert req.max_id is None
        assert req.seen_posts is None
        assert req.reason is None
        assert req.min_posts is None

    def test_with_pagination(self):
        req = FeedRequest(
            session_data='{}',
            max_id="cursor123",
            seen_posts="111_222,333_444",
            reason="pagination",
            min_posts=10,
        )
        assert req.max_id == "cursor123"
        assert req.min_posts == 10


class TestSearchHashtagRequest:
    def test_requires_hashtag(self):
        with pytest.raises(ValidationError):
            SearchHashtagRequest(session_data='{}')

    def test_valid_minimal(self):
        req = SearchHashtagRequest(session_data='{}', hashtag="nature")
        assert req.hashtag == "nature"
        assert req.amount == 30  # default
        assert req.next_max_id is None

    def test_custom_amount(self):
        req = SearchHashtagRequest(session_data='{}', hashtag="cats", amount=50)
        assert req.amount == 50


class TestCommentRequest:
    def test_requires_media_id(self):
        with pytest.raises(ValidationError):
            CommentRequest(session_data='{}', text="hello")

    def test_requires_text(self):
        with pytest.raises(ValidationError):
            CommentRequest(session_data='{}', media_id="123_456")

    def test_valid(self):
        req = CommentRequest(session_data='{}', media_id="123_456", text="Great post!")
        assert req.media_id == "123_456"
        assert req.text == "Great post!"


class TestFetchCommentsRequest:
    def test_requires_media_pk(self):
        with pytest.raises(ValidationError):
            FetchCommentsRequest(session_data='{}')

    def test_valid_minimal(self):
        req = FetchCommentsRequest(session_data='{}', media_pk="123456")
        assert req.media_pk == "123456"
        assert req.min_id is None

    def test_with_pagination(self):
        req = FetchCommentsRequest(session_data='{}', media_pk="123456", min_id="cursor")
        assert req.min_id == "cursor"


class TestFetchCommentRepliesRequest:
    def test_requires_media_pk_and_comment_pk(self):
        with pytest.raises(ValidationError):
            FetchCommentRepliesRequest(session_data='{}')

    def test_valid(self):
        req = FetchCommentRepliesRequest(session_data='{}', media_pk="123456", comment_pk="789")
        assert req.media_pk == "123456"
        assert req.comment_pk == "789"
        assert req.min_id is None


class TestSearchLocationsRequest:
    def test_requires_query(self):
        with pytest.raises(ValidationError):
            SearchLocationsRequest(session_data='{}')

    def test_valid(self):
        req = SearchLocationsRequest(session_data='{}', query="Moscow")
        assert req.query == "Moscow"


class TestSearchLocationRequest:
    def test_requires_location_pk(self):
        with pytest.raises(ValidationError):
            SearchLocationRequest(session_data='{}')

    def test_valid_minimal(self):
        req = SearchLocationRequest(session_data='{}', location_pk=12345)
        assert req.location_pk == 12345
        assert req.amount == 30  # default

    def test_with_pagination(self):
        req = SearchLocationRequest(session_data='{}', location_pk=12345, next_max_id='{"cursor": "abc"}')
        assert req.next_max_id == '{"cursor": "abc"}'


class TestMediaLikeRequest:
    def test_requires_media_id(self):
        with pytest.raises(ValidationError):
            MediaLikeRequest(session_data='{}')

    def test_requires_session_data(self):
        with pytest.raises(ValidationError):
            MediaLikeRequest(media_id="111_999")

    def test_valid(self):
        req = MediaLikeRequest(session_data='{}', media_id="111_999")
        assert req.media_id == "111_999"


class TestUserInfoByPkRequest:
    def test_requires_user_pk(self):
        with pytest.raises(ValidationError):
            UserInfoByPkRequest(session_data='{}')

    def test_requires_session_data(self):
        with pytest.raises(ValidationError):
            UserInfoByPkRequest(user_pk="123456")

    def test_valid(self):
        req = UserInfoByPkRequest(session_data='{}', user_pk="123456")
        assert req.user_pk == "123456"


class TestResponseSchemas:
    def test_login_response_requires_success(self):
        with pytest.raises(ValidationError):
            LoginResponse()

    def test_login_response_success(self):
        resp = LoginResponse(success=True, session_data='{}', full_name="Test")
        assert resp.success is True
        assert resp.error is None

    def test_login_response_error(self):
        resp = LoginResponse(success=False, error="Bad password", error_code="login_required")
        assert resp.success is False
        assert resp.error_code == "login_required"

    def test_feed_response_defaults(self):
        resp = FeedResponse(success=True)
        assert resp.posts == []
        assert resp.more_available is False
        assert resp.next_max_id is None

    def test_account_info_response_optional_fields(self):
        resp = AccountInfoResponse(success=True)
        assert resp.user_pk is None
        assert resp.followers_count is None

    def test_search_response_items_default_empty(self):
        resp = SearchResponse(success=True)
        assert resp.items == []

    def test_comment_response_success(self):
        resp = CommentResponse(success=True, comment_pk="12345")
        assert resp.comment_pk == "12345"
