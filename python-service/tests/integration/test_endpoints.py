"""
Integration-тесты для main.py — все эндпоинты через FastAPI TestClient.

Что мокается:
  - client._make_client — возвращает MagicMock вместо реального instagrapi.Client
  - main.Client — для /auth/login, где Client создаётся напрямую

Что тестируется:
  - FastAPI routing (правильный URL и метод)
  - Pydantic validation (422 при невалидных данных)
  - Маппинг ответов (success/error структура)
  - Error handling (инстаграмные исключения → правильный HTTP-статус + error_code)
"""

import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from instagrapi.exceptions import (
    ChallengeRequired,
    ClientThrottledError,
    LoginRequired,
    PleaseWaitFewMinutes,
)

from tests.conftest import SAMPLE_SESSION_DATA


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    from main import app
    return TestClient(app)


def make_mock_client(**overrides) -> MagicMock:
    """Создаёт мок instagrapi.Client с разумными дефолтами."""
    cl = MagicMock()
    cl.uuid = "test-uuid"
    cl.phone_id = "test-phone-id"
    cl.token = "test-csrf-token"
    cl.client_session_id = "test-session-id"
    cl.timezone_offset = 0
    cl.rank_token = "test-rank-token"
    cl.last_json = None
    for key, value in overrides.items():
        setattr(cl, key, value)
    return cl


def make_media_raw(pk="111111", media_id="111111_999999") -> dict:
    return {
        "pk": pk,
        "id": media_id,
        "code": "ABC123",
        "taken_at": 1700000000,
        "media_type": 1,
        "image_versions2": {"candidates": [{"url": "https://cdn.example.com/photo.jpg", "width": 1080, "height": 1080}]},
        "caption": {"text": "Test post"},
        "like_count": 10,
        "comment_count": 2,
        "has_liked": False,
        "user": {
            "pk": "999999",
            "username": "testuser",
            "full_name": "Test User",
            "profile_pic_url": None,
        },
    }


def make_comment_raw(pk="555", text="Nice!") -> dict:
    return {
        "pk": pk,
        "text": text,
        "created_at_utc": 1700000000,
        "user": {"pk": "999", "username": "commenter", "full_name": "", "profile_pic_url": None},
        "comment_like_count": 0,
        "has_liked_comment": False,
        "child_comment_count": 0,
    }


SESSION_PAYLOAD = {"session_data": SAMPLE_SESSION_DATA}


# ─── GET /health ──────────────────────────────────────────────────────────────

class TestHealth:
    def test_returns_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


# ─── POST /auth/login ─────────────────────────────────────────────────────────

class TestLogin:
    def _mock_client(self, session_data_str: str, full_name="Test User", pic_url="https://pic.url/a.jpg"):
        mock_cl = make_mock_client()
        mock_cl.get_settings.return_value = json.loads(session_data_str)
        account = MagicMock()
        account.full_name = full_name
        account.profile_pic_url = pic_url
        mock_cl.account_info.return_value = account
        return mock_cl

    def test_success(self, client):
        mock_cl = self._mock_client(SAMPLE_SESSION_DATA)
        with patch("main.Client", return_value=mock_cl):
            resp = client.post("/auth/login", json={"login": "user", "password": "pass"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["session_data"] is not None
        assert body["full_name"] == "Test User"
        assert body["profile_pic_url"] is not None

    def test_challenge_required_returns_401(self, client):
        mock_cl = make_mock_client()
        mock_cl.login.side_effect = ChallengeRequired()
        with patch("main.Client", return_value=mock_cl):
            resp = client.post("/auth/login", json={"login": "user", "password": "pass"})

        assert resp.status_code == 401
        body = resp.json()
        assert body["success"] is False
        assert body["error_code"] == "challenge_required"

    def test_login_required_returns_401(self, client):
        mock_cl = make_mock_client()
        mock_cl.login.side_effect = LoginRequired()
        with patch("main.Client", return_value=mock_cl):
            resp = client.post("/auth/login", json={"login": "user", "password": "pass"})

        assert resp.status_code == 401
        assert resp.json()["error_code"] == "login_required"

    def test_missing_login_returns_422(self, client):
        resp = client.post("/auth/login", json={"password": "pass"})
        assert resp.status_code == 422

    def test_missing_password_returns_422(self, client):
        resp = client.post("/auth/login", json={"login": "user"})
        assert resp.status_code == 422

    def test_with_device_profile(self, client):
        mock_cl = self._mock_client(SAMPLE_SESSION_DATA)
        with patch("main.Client", return_value=mock_cl):
            resp = client.post("/auth/login", json={
                "login": "user",
                "password": "pass",
                "device_profile": {"device_settings": {"app_version": "269.0"}, "user_agent": "Instagram/269.0"},
            })
        assert resp.status_code == 200
        mock_cl.set_device.assert_called_once()
        mock_cl.set_user_agent.assert_called_once()


# ─── POST /account/info ───────────────────────────────────────────────────────

class TestAccountInfo:
    def test_success(self, client):
        mock_cl = make_mock_client()
        info = MagicMock()
        info.pk = 123456789
        mock_cl.account_info.return_value = info

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/account/info", json=SESSION_PAYLOAD)

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["user_pk"] == 123456789

    def test_login_required_returns_401(self, client):
        mock_cl = make_mock_client()
        mock_cl.account_info.side_effect = LoginRequired()

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/account/info", json=SESSION_PAYLOAD)

        assert resp.status_code == 401
        assert resp.json()["error_code"] == "login_required"

    def test_missing_session_data_returns_422(self, client):
        resp = client.post("/account/info", json={})
        assert resp.status_code == 422


# ─── POST /account/feed ───────────────────────────────────────────────────────

class TestFeed:
    def test_cold_start(self, client):
        mock_cl = make_mock_client()
        raw_feed = {
            "feed_items": [{"media_or_ad": make_media_raw("101", "101_999")}],
            "next_max_id": "cursor_abc",
            "more_available": True,
        }
        mock_cl.get_timeline_feed.return_value = raw_feed

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/account/feed", json={**SESSION_PAYLOAD, "reason": "cold_start_fetch"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["posts"]) == 1
        assert body["posts"][0]["pk"] == "101"
        assert body["next_max_id"] == "cursor_abc"
        assert body["more_available"] is True

    def test_cold_start_empty_feed(self, client):
        mock_cl = make_mock_client()
        mock_cl.get_timeline_feed.return_value = {
            "feed_items": [],
            "next_max_id": None,
            "more_available": False,
        }

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/account/feed", json=SESSION_PAYLOAD)

        assert resp.status_code == 200
        body = resp.json()
        assert body["posts"] == []
        assert body["more_available"] is False

    def test_pagination_with_max_id(self, client):
        mock_cl = make_mock_client()
        mock_cl.private_request.return_value = {
            "feed_items": [{"media_or_ad": make_media_raw("201", "201_999")}],
            "next_max_id": "cursor_next",
            "more_available": True,
        }

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/account/feed", json={
                **SESSION_PAYLOAD,
                "max_id": "cursor_abc",
                "seen_posts": "101_999,102_999",
            })

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["posts"]) == 1
        assert body["posts"][0]["pk"] == "201"

    def test_rate_limited_returns_429(self, client):
        mock_cl = make_mock_client()
        mock_cl.get_timeline_feed.side_effect = PleaseWaitFewMinutes()

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/account/feed", json=SESSION_PAYLOAD)

        assert resp.status_code == 429
        assert resp.json()["error_code"] == "rate_limited"


# ─── POST /media/like ─────────────────────────────────────────────────────────

class TestMediaLike:
    def test_success(self, client):
        mock_cl = make_mock_client()
        mock_cl.media_like.return_value = True

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/media/like", json={**SESSION_PAYLOAD, "media_id": "111_999"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        mock_cl.media_like.assert_called_once_with("111_999")

    def test_rate_limited_returns_429(self, client):
        mock_cl = make_mock_client()
        mock_cl.media_like.side_effect = ClientThrottledError()

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/media/like", json={**SESSION_PAYLOAD, "media_id": "111_999"})

        assert resp.status_code == 429
        assert resp.json()["error_code"] == "rate_limited"

    def test_login_required_returns_401(self, client):
        mock_cl = make_mock_client()
        mock_cl.media_like.side_effect = LoginRequired()

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/media/like", json={**SESSION_PAYLOAD, "media_id": "111_999"})

        assert resp.status_code == 401

    def test_missing_media_id_returns_422(self, client):
        resp = client.post("/media/like", json=SESSION_PAYLOAD)
        assert resp.status_code == 422


# ─── POST /media/comment ──────────────────────────────────────────────────────

class TestMediaComment:
    def test_success(self, client):
        mock_cl = make_mock_client()
        comment = MagicMock()
        comment.pk = 999888777
        mock_cl.media_comment.return_value = comment

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/media/comment", json={
                **SESSION_PAYLOAD,
                "media_id": "111_999",
                "text": "Great post!",
            })

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["comment_pk"] == "999888777"

    def test_missing_text_returns_422(self, client):
        resp = client.post("/media/comment", json={**SESSION_PAYLOAD, "media_id": "111_999"})
        assert resp.status_code == 422

    def test_challenge_required_returns_401(self, client):
        mock_cl = make_mock_client()
        mock_cl.media_comment.side_effect = ChallengeRequired()

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/media/comment", json={
                **SESSION_PAYLOAD, "media_id": "111_999", "text": "hi",
            })

        assert resp.status_code == 401
        assert resp.json()["error_code"] == "challenge_required"


# ─── POST /user/info ──────────────────────────────────────────────────────────

class TestUserInfo:
    def _make_user_mock(self):
        user = MagicMock()
        user.pk = 123456
        user.username = "testuser"
        user.full_name = "Test User"
        user.profile_pic_url = "https://pic.url/a.jpg"
        user.biography = "Bio text"
        user.external_url = None
        user.is_private = False
        user.is_verified = False
        user.media_count = 50
        user.follower_count = 1000
        user.following_count = 500
        return user

    def test_success(self, client):
        mock_cl = make_mock_client()
        mock_cl.user_info.return_value = self._make_user_mock()

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/user/info", json={**SESSION_PAYLOAD, "user_pk": "123456"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["user"]["username"] == "testuser"
        assert body["user"]["pk"] == "123456"
        assert body["user"]["follower_count"] == 1000

    def test_missing_user_pk_returns_422(self, client):
        resp = client.post("/user/info", json=SESSION_PAYLOAD)
        assert resp.status_code == 422

    def test_login_required_returns_401(self, client):
        mock_cl = make_mock_client()
        mock_cl.user_info.side_effect = LoginRequired()

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/user/info", json={**SESSION_PAYLOAD, "user_pk": "123456"})

        assert resp.status_code == 401


# ─── POST /search/hashtag ─────────────────────────────────────────────────────

class TestSearchHashtag:
    def _mock_sections_response(self, pk="301"):
        return {
            "sections": [{"layout_content": {"medias": [{"media": make_media_raw(pk, f"{pk}_999")}]}}],
            "more_available": True,
            "next_max_id": "cursor_next",
            "next_page": 2,
            "next_media_ids": [],
        }

    def test_success(self, client):
        mock_cl = make_mock_client()
        mock_cl.private_request.return_value = self._mock_sections_response("301")

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/search/hashtag", json={**SESSION_PAYLOAD, "hashtag": "nature"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["items"]) == 1
        assert body["items"][0]["pk"] == "301"
        assert body["next_max_id"] is not None

    def test_empty_result(self, client):
        mock_cl = make_mock_client()
        mock_cl.private_request.return_value = {"sections": [], "more_available": False}

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/search/hashtag", json={**SESSION_PAYLOAD, "hashtag": "emptytag"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["items"] == []
        assert body["next_max_id"] is None

    def test_missing_hashtag_returns_422(self, client):
        resp = client.post("/search/hashtag", json=SESSION_PAYLOAD)
        assert resp.status_code == 422

    def test_rate_limited_returns_429(self, client):
        mock_cl = make_mock_client()
        mock_cl.private_request.side_effect = PleaseWaitFewMinutes()

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/search/hashtag", json={**SESSION_PAYLOAD, "hashtag": "nature"})

        assert resp.status_code == 429
        assert resp.json()["error_code"] == "rate_limited"

    def test_url_encodes_hashtag(self, client):
        """Кириллица в хэштеге должна корректно кодироваться в URL."""
        mock_cl = make_mock_client()
        mock_cl.private_request.return_value = {"sections": [], "more_available": False}

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/search/hashtag", json={**SESSION_PAYLOAD, "hashtag": "природа"})

        assert resp.status_code == 200
        call_args = mock_cl.private_request.call_args
        endpoint = call_args[0][0]
        # endpoint не должен содержать кириллицу — только %XX
        assert "природа" not in endpoint
        assert "%" in endpoint


# ─── POST /search/locations ───────────────────────────────────────────────────

class TestSearchLocations:
    def test_success(self, client):
        mock_cl = make_mock_client()
        place = MagicMock()
        place.pk = 12345
        place.name = "Moscow, Russia"
        place.address = "Red Square"
        place.lat = 55.7558
        place.lng = 37.6176
        mock_cl.fbsearch_places.return_value = [place]

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/search/locations", json={**SESSION_PAYLOAD, "query": "Moscow"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["locations"]) == 1
        assert body["locations"][0]["pk"] == 12345
        assert body["locations"][0]["name"] == "Moscow, Russia"

    def test_empty_result(self, client):
        mock_cl = make_mock_client()
        mock_cl.fbsearch_places.return_value = []

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/search/locations", json={**SESSION_PAYLOAD, "query": "noresults"})

        assert resp.status_code == 200
        assert resp.json()["locations"] == []

    def test_missing_query_returns_422(self, client):
        resp = client.post("/search/locations", json=SESSION_PAYLOAD)
        assert resp.status_code == 422


# ─── POST /search/location ────────────────────────────────────────────────────

class TestSearchLocation:
    def test_success(self, client):
        mock_cl = make_mock_client()
        mock_cl.private_request.return_value = {
            "sections": [{"layout_content": {"medias": [{"media": make_media_raw("401", "401_999")}]}}],
            "more_available": False,
        }

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/search/location", json={**SESSION_PAYLOAD, "location_pk": 12345})

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["items"]) == 1
        assert body["items"][0]["pk"] == "401"

    def test_missing_location_pk_returns_422(self, client):
        resp = client.post("/search/location", json=SESSION_PAYLOAD)
        assert resp.status_code == 422

    def test_login_required_returns_401(self, client):
        mock_cl = make_mock_client()
        mock_cl.private_request.side_effect = LoginRequired()

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/search/location", json={**SESSION_PAYLOAD, "location_pk": 12345})

        assert resp.status_code == 401


# ─── POST /media/comments ─────────────────────────────────────────────────────

class TestMediaComments:
    def test_success(self, client):
        mock_cl = make_mock_client()
        mock_cl.private_request.return_value = {
            "comments": [make_comment_raw("555"), make_comment_raw("556", "Another!")],
            "comment_count": 10,
            "has_more_headload_comments": True,
            "next_min_id": "cursor_next",
        }

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/media/comments", json={**SESSION_PAYLOAD, "media_pk": "123456"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["comments"]) == 2
        assert body["comment_count"] == 10
        assert body["next_min_id"] == "cursor_next"

    def test_with_pagination_min_id(self, client):
        mock_cl = make_mock_client()
        mock_cl.private_request.return_value = {
            "comments": [make_comment_raw("444")],
            "comment_count": 5,
            "has_more_headload_comments": False,
        }

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/media/comments", json={
                **SESSION_PAYLOAD, "media_pk": "123456", "min_id": "cursor_abc",
            })

        assert resp.status_code == 200
        assert resp.json()["next_min_id"] is None

        # Проверяем, что min_id передан в params к private_request
        call_kwargs = mock_cl.private_request.call_args
        params = call_kwargs[1].get("params") or call_kwargs[0][1]
        assert params.get("min_id") == "cursor_abc"

    def test_empty_comments(self, client):
        mock_cl = make_mock_client()
        mock_cl.private_request.return_value = {
            "comments": [], "comment_count": 0, "has_more_headload_comments": False,
        }

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/media/comments", json={**SESSION_PAYLOAD, "media_pk": "123456"})

        assert resp.status_code == 200
        assert resp.json()["comments"] == []

    def test_missing_media_pk_returns_422(self, client):
        resp = client.post("/media/comments", json=SESSION_PAYLOAD)
        assert resp.status_code == 422


# ─── POST /media/comments/replies ─────────────────────────────────────────────

class TestCommentReplies:
    def test_success(self, client):
        mock_cl = make_mock_client()
        mock_cl.private_request.return_value = {
            "child_comments": [make_comment_raw("777", "Reply!")],
            "child_comment_count": 3,
            "has_more_tail_child_comments": True,
            "next_max_child_cursor": "cursor_next",
        }

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/media/comments/replies", json={
                **SESSION_PAYLOAD, "media_pk": "123456", "comment_pk": "555",
            })

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["child_comments"]) == 1
        assert body["child_comment_count"] == 3
        assert body["next_min_id"] == "cursor_next"

    def test_missing_comment_pk_returns_422(self, client):
        resp = client.post("/media/comments/replies", json={**SESSION_PAYLOAD, "media_pk": "123456"})
        assert resp.status_code == 422

    def test_login_required_returns_401(self, client):
        mock_cl = make_mock_client()
        mock_cl.private_request.side_effect = LoginRequired()

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post("/media/comments/replies", json={
                **SESSION_PAYLOAD, "media_pk": "123456", "comment_pk": "555",
            })

        assert resp.status_code == 401


# ─── Общее: LoginRequired деактивирует аккаунт ──────────────────────────────

class TestCommonErrorBehavior:
    """Проверяет общее поведение error handling для нескольких эндпоинтов."""

    @pytest.mark.parametrize("endpoint,payload_extra,mock_method", [
        ("/account/info", {}, "account_info"),
        ("/media/like", {"media_id": "111_999"}, "media_like"),
    ])
    def test_login_required_returns_401(self, client, endpoint, payload_extra, mock_method):
        mock_cl = make_mock_client()
        getattr(mock_cl, mock_method).side_effect = LoginRequired()

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post(endpoint, json={**SESSION_PAYLOAD, **payload_extra})

        assert resp.status_code == 401
        assert resp.json()["error_code"] == "login_required"

    @pytest.mark.parametrize("endpoint,payload_extra,mock_method", [
        ("/account/info", {}, "account_info"),
        ("/media/like", {"media_id": "111_999"}, "media_like"),
    ])
    def test_challenge_required_returns_401(self, client, endpoint, payload_extra, mock_method):
        mock_cl = make_mock_client()
        getattr(mock_cl, mock_method).side_effect = ChallengeRequired()

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post(endpoint, json={**SESSION_PAYLOAD, **payload_extra})

        assert resp.status_code == 401
        assert resp.json()["error_code"] == "challenge_required"

    @pytest.mark.parametrize("endpoint,payload_extra,mock_method", [
        ("/account/info", {}, "account_info"),
        ("/media/like", {"media_id": "111_999"}, "media_like"),
        ("/media/comment", {"media_id": "111_999", "text": "hi"}, "media_comment"),
    ])
    def test_generic_exception_returns_500_without_traceback(self, client, endpoint, payload_extra, mock_method):
        mock_cl = make_mock_client()
        getattr(mock_cl, mock_method).side_effect = RuntimeError("internal failure")

        with patch("main._make_client", return_value=mock_cl):
            resp = client.post(endpoint, json={**SESSION_PAYLOAD, **payload_extra})

        assert resp.status_code == 500
        body = resp.json()
        assert body["success"] is False
        assert body["error_code"] == "error"
        assert "Traceback" not in body["error"]
