"""
Unit-тесты для helpers.py — сериализация медиа/комментариев, пагинация.
"""

import json
from unittest.mock import MagicMock, patch

import pytest

from helpers import (
    _build_pagination_params,
    _build_sections_cursor,
    _extract_posts,
    _extract_sections_posts,
    _fetch_sections,
    _instagram_response_debug,
    _paginate_feed,
    _parse_sections_cursor,
    _serialize_comment,
    _serialize_media,
)


# ─── Fixtures ────────────────────────────────────────────────────────────────

def make_media(
    pk="111111",
    media_id="111111_999999",
    media_type=1,
    thumbnail_url="https://cdn.example.com/photo.jpg",
    user_pk="999999",
    username="testuser",
    caption="Test caption",
    like_count=42,
    has_liked=False,
    **kwargs,
) -> dict:
    """Минимальный raw медиа-объект."""
    return {
        "pk": pk,
        "id": media_id,
        "code": "ABC123",
        "taken_at": 1700000000,
        "media_type": media_type,
        "image_versions2": {"candidates": [{"url": thumbnail_url, "width": 1080, "height": 1080}]},
        "caption": {"text": caption},
        "like_count": like_count,
        "comment_count": 5,
        "has_liked": has_liked,
        "user": {
            "pk": user_pk,
            "username": username,
            "full_name": "Test User",
            "profile_pic_url": "https://cdn.example.com/avatar.jpg",
        },
        **kwargs,
    }


def make_comment(pk="555", text="Nice!", user_pk="999", username="commenter") -> dict:
    return {
        "pk": pk,
        "text": text,
        "created_at_utc": 1700000000,
        "user": {"pk": user_pk, "username": username, "full_name": "Commenter", "profile_pic_url": None},
        "comment_like_count": 3,
        "has_liked_comment": False,
        "child_comment_count": 0,
    }


def make_client_mock(**kwargs) -> MagicMock:
    cl = MagicMock()
    cl.phone_id = "phone-id-001"
    cl.uuid = "uuid-001"
    cl.token = "csrf-token"
    cl.client_session_id = "session-id-001"
    cl.timezone_offset = 0
    for key, value in kwargs.items():
        setattr(cl, key, value)
    return cl


# ─── _serialize_media ─────────────────────────────────────────────────────────

class TestSerializeMedia:
    def test_basic_photo(self):
        raw = make_media()
        result = _serialize_media(raw)

        assert result is not None
        assert result["pk"] == "111111"
        assert result["id"] == "111111_999999"
        assert result["media_type"] == 1
        assert result["thumbnail_url"] == "https://cdn.example.com/photo.jpg"
        assert result["video_url"] is None
        assert result["caption_text"] == "Test caption"
        assert result["like_count"] == 42
        assert result["has_liked"] is False
        assert result["user"]["username"] == "testuser"

    def test_returns_none_for_empty_dict(self):
        assert _serialize_media({}) is None

    def test_returns_none_for_none(self):
        assert _serialize_media(None) is None

    def test_video_media_type(self):
        raw = make_media(
            media_type=2,
            video_versions=[{"url": "https://cdn.example.com/video.mp4", "width": 720, "height": 1280}],
        )
        result = _serialize_media(raw)
        assert result["media_type"] == 2
        assert result["video_url"] == "https://cdn.example.com/video.mp4"

    def test_carousel_media_type(self):
        raw = make_media(
            media_type=8,
            carousel_media=[
                {
                    "pk": "222",
                    "media_type": 1,
                    "image_versions2": {"candidates": [{"url": "https://cdn.example.com/slide1.jpg", "width": 1080, "height": 1080}]},
                    "original_width": 1080,
                    "original_height": 1080,
                },
                {
                    "pk": "333",
                    "media_type": 2,
                    "image_versions2": {"candidates": [{"url": "https://cdn.example.com/slide2.jpg", "width": 1080, "height": 1080}]},
                    "video_versions": [{"url": "https://cdn.example.com/slide2.mp4"}],
                    "original_width": 1080,
                    "original_height": 1920,
                },
            ],
        )
        result = _serialize_media(raw)
        assert result["media_type"] == 8
        assert len(result["resources"]) == 2
        assert result["resources"][0]["pk"] == "222"
        assert result["resources"][0]["video_url"] is None
        assert result["resources"][1]["pk"] == "333"
        assert result["resources"][1]["video_url"] == "https://cdn.example.com/slide2.mp4"

    def test_missing_thumbnail(self):
        raw = make_media()
        raw["image_versions2"] = {}
        result = _serialize_media(raw)
        assert result["thumbnail_url"] is None

    def test_none_caption(self):
        raw = make_media()
        raw["caption"] = None
        result = _serialize_media(raw)
        assert result["caption_text"] == ""

    def test_location_fields(self):
        raw = make_media(location={"pk": 12345, "name": "Moscow, Russia"})
        result = _serialize_media(raw)
        assert result["location_pk"] == 12345
        assert result["location_name"] == "Moscow, Russia"

    def test_taken_at_iso_format(self):
        raw = make_media()
        result = _serialize_media(raw)
        assert result["taken_at"].endswith("+00:00") or result["taken_at"].endswith("Z") or "T" in result["taken_at"]

    def test_pk_is_string(self):
        raw = make_media(pk=123456)
        result = _serialize_media(raw)
        assert isinstance(result["pk"], str)
        assert result["pk"] == "123456"

    def test_user_pk_is_string(self):
        raw = make_media(user_pk=999)
        result = _serialize_media(raw)
        assert isinstance(result["user"]["pk"], str)


# ─── _serialize_comment ───────────────────────────────────────────────────────

class TestSerializeComment:
    def test_basic_comment(self):
        raw = make_comment()
        result = _serialize_comment(raw)

        assert result["pk"] == "555"
        assert result["text"] == "Nice!"
        assert result["user"]["username"] == "commenter"
        assert result["like_count"] == 3
        assert result["has_liked"] is False
        assert result["child_comment_count"] == 0
        assert result["preview_child_comments"] == []

    def test_pk_is_string(self):
        raw = make_comment(pk=999)
        result = _serialize_comment(raw)
        assert isinstance(result["pk"], str)

    def test_preview_child_comments(self):
        raw = make_comment()
        raw["preview_child_comments"] = [make_comment(pk="888", text="Reply")]
        result = _serialize_comment(raw)
        assert len(result["preview_child_comments"]) == 1
        assert result["preview_child_comments"][0]["pk"] == "888"

    def test_missing_user_fields(self):
        raw = {"pk": "1", "text": "hi", "created_at_utc": 1700000000, "user": {}}
        result = _serialize_comment(raw)
        assert result["user"]["pk"] == ""
        assert result["user"]["username"] == ""


# ─── _extract_posts ───────────────────────────────────────────────────────────

class TestExtractPosts:
    def test_extracts_posts_from_feed_items(self):
        raw = {
            "feed_items": [
                {"media_or_ad": make_media(pk="101", media_id="101_999")},
                {"media_or_ad": make_media(pk="102", media_id="102_999")},
            ]
        }
        posts = _extract_posts(raw)
        assert len(posts) == 2
        assert posts[0]["pk"] == "101"
        assert posts[1]["pk"] == "102"

    def test_skips_items_without_media_or_ad(self):
        raw = {
            "feed_items": [
                {"media_or_ad": make_media(pk="101", media_id="101_999")},
                {"some_other_key": {}},
            ]
        }
        posts = _extract_posts(raw)
        assert len(posts) == 1

    def test_empty_feed(self):
        assert _extract_posts({"feed_items": []}) == []

    def test_missing_feed_items_key(self):
        assert _extract_posts({}) == []


# ─── _extract_sections_posts ──────────────────────────────────────────────────

class TestExtractSectionsPosts:
    def _make_sections_raw(self, pks: list) -> dict:
        medias = [{"media": make_media(pk=pk, media_id=f"{pk}_999")} for pk in pks]
        return {
            "sections": [
                {"layout_content": {"medias": medias}}
            ]
        }

    def test_extracts_posts_from_sections(self):
        raw = self._make_sections_raw(["201", "202", "203"])
        posts = _extract_sections_posts(raw)
        assert len(posts) == 3
        assert posts[0]["pk"] == "201"

    def test_respects_amount_limit(self):
        raw = self._make_sections_raw(["201", "202", "203", "204", "205"])
        posts = _extract_sections_posts(raw, amount=3)
        assert len(posts) == 3

    def test_empty_sections(self):
        assert _extract_sections_posts({"sections": []}) == []

    def test_multiple_sections(self):
        raw = {
            "sections": [
                {"layout_content": {"medias": [{"media": make_media(pk="301", media_id="301_999")}]}},
                {"layout_content": {"medias": [{"media": make_media(pk="302", media_id="302_999")}]}},
            ]
        }
        posts = _extract_sections_posts(raw)
        assert len(posts) == 2


# ─── _build_pagination_params ─────────────────────────────────────────────────

class TestBuildPaginationParams:
    def test_contains_required_fields(self):
        cl = make_client_mock()
        params = _build_pagination_params(cl, "cursor123", ["111_999", "222_999"])

        assert params["max_id"] == "cursor123"
        assert params["reason"] == "pagination"
        assert params["seen_posts"] == "111_999,222_999"
        assert params["phone_id"] == cl.phone_id
        assert params["device_id"] == cl.uuid
        assert "_uuid" in params
        assert "feed_view_info" in params

    def test_feed_view_info_is_valid_json(self):
        cl = make_client_mock()
        params = _build_pagination_params(cl, "cursor", ["111_999"])
        view_info = json.loads(params["feed_view_info"])
        assert isinstance(view_info, list)
        assert len(view_info) == 1
        assert view_info[0]["media_id"] == "111_999"

    def test_empty_seen_posts(self):
        cl = make_client_mock()
        params = _build_pagination_params(cl, "cursor", [])
        assert params["seen_posts"] == ""
        view_info = json.loads(params["feed_view_info"])
        assert view_info == []


# ─── _instagram_response_debug ────────────────────────────────────────────────

class TestInstagramResponseDebug:
    def test_empty_or_none(self):
        assert _instagram_response_debug(None) == {}
        assert _instagram_response_debug({}) == {}

    def test_feed_response(self):
        raw = {
            "status": "ok",
            "feed_items": [
                {"media_or_ad": {"pk": "111"}},
                {"media_or_ad": {"pk": "222"}},
            ],
            "more_available": True,
            "next_max_id": "cursor123",
        }
        debug = _instagram_response_debug(raw)
        assert debug["feed_items_count"] == 2
        assert debug["more_available"] is True
        assert debug["has_next_max_id"] is True

    def test_sections_response(self):
        raw = {
            "status": "ok",
            "sections": [{"layout_type": "media", "layout_content": {"medias": []}}],
            "more_available": False,
        }
        debug = _instagram_response_debug(raw)
        assert debug["sections_count"] == 1
        assert debug["more_available"] is False

    def test_comment_response(self):
        raw = {"status": "ok", "comment": {"pk": "555", "text": "hi", "created_at": 1700000000}}
        debug = _instagram_response_debug(raw)
        assert debug["comment"]["pk"] == "555"
        assert debug["comment"]["text"] == "hi"

    def test_comments_list_response(self):
        raw = {
            "status": "ok",
            "comments": [{"pk": "1"}, {"pk": "2"}],
            "comment_count": 10,
            "has_more_headload_comments": True,
        }
        debug = _instagram_response_debug(raw)
        assert debug["comment_count"] == 10
        assert debug["returned"] == 2
        assert debug["has_more"] is True


# ─── _build_sections_cursor & _parse_sections_cursor ─────────────────────────

class TestSectionsCursor:
    def test_build_cursor_with_pagination(self):
        raw = {
            "next_max_id": "cursor_abc",
            "more_available": True,
            "next_page": 2,
            "next_media_ids": [111, 222],
        }
        cursor = _build_sections_cursor(raw)
        assert cursor is not None
        parsed = json.loads(cursor)
        assert parsed["max_id"] == "cursor_abc"
        assert parsed["page"] == 2
        assert parsed["media_ids"] == [111, 222]

    def test_build_cursor_returns_none_when_no_more(self):
        raw = {"next_max_id": "cursor_abc", "more_available": False}
        assert _build_sections_cursor(raw) is None

    def test_build_cursor_returns_none_when_no_next_max_id(self):
        raw = {"more_available": True}
        assert _build_sections_cursor(raw) is None

    def test_parse_cursor_basic(self):
        cursor = json.dumps({"max_id": "abc", "page": 2, "media_ids": [1, 2]})
        params = _parse_sections_cursor(cursor)
        assert params["max_id"] == "abc"
        assert params["page"] == 2
        assert params["media_ids"] == "1,2"

    def test_parse_cursor_without_page(self):
        cursor = json.dumps({"max_id": "abc", "media_ids": []})
        params = _parse_sections_cursor(cursor)
        assert "page" not in params
        assert "media_ids" not in params


# ─── _paginate_feed ───────────────────────────────────────────────────────────

class TestPaginateFeed:
    def test_single_page(self):
        cl = make_client_mock()
        cl.private_request.return_value = {
            "feed_items": [{"media_or_ad": make_media(pk="101", media_id="101_999")}],
            "next_max_id": None,
            "more_available": False,
        }
        all_posts = []
        seen = []
        next_max_id, more = _paginate_feed(cl, "start_cursor", seen, all_posts, None, "test")

        assert len(all_posts) == 1
        assert next_max_id is None
        assert more is False

    def test_stops_when_min_posts_reached(self):
        cl = make_client_mock()
        cl.private_request.side_effect = [
            {
                "feed_items": [{"media_or_ad": make_media(pk="101", media_id="101_999")}],
                "next_max_id": "cursor2",
                "more_available": True,
            },
            {
                "feed_items": [{"media_or_ad": make_media(pk="102", media_id="102_999")}],
                "next_max_id": "cursor3",
                "more_available": True,
            },
        ]
        all_posts = []
        seen = []
        _paginate_feed(cl, "cursor1", seen, all_posts, min_posts=1, label="test")

        # Должен остановиться после первой итерации (min_posts=1 достигнут)
        assert len(all_posts) == 1
        assert cl.private_request.call_count == 1

    def test_stops_at_max_iterations(self):
        from helpers import MAX_PAGINATION_ITERATIONS

        cl = make_client_mock()
        # Всегда возвращает more_available=True — симулируем бесконечную ленту
        cl.private_request.return_value = {
            "feed_items": [{"media_or_ad": make_media(pk="101", media_id="101_999")}],
            "next_max_id": "next_cursor",
            "more_available": True,
        }
        all_posts = []
        seen = []

        # min_posts=9999 — заведомо недостижимо, чтобы не сработал break по min_posts
        with patch("helpers.time.sleep"):  # не ждём реально
            _paginate_feed(cl, "cursor1", seen, all_posts, min_posts=9999, label="test")

        assert cl.private_request.call_count == MAX_PAGINATION_ITERATIONS


# ─── _fetch_sections ──────────────────────────────────────────────────────────

class TestFetchSections:
    def test_basic_fetch(self):
        cl = make_client_mock()
        cl.private_request.return_value = {
            "sections": [
                {"layout_content": {"medias": [{"media": make_media(pk="501", media_id="501_999")}]}}
            ],
            "more_available": True,
            "next_max_id": "cursor_next",
            "next_page": 2,
            "next_media_ids": [],
        }

        posts, cursor = _fetch_sections(cl, "tags/nature/sections/", {"tag_name": "nature"}, None, 30)

        assert len(posts) == 1
        assert posts[0]["pk"] == "501"
        assert cursor is not None

    def test_with_cursor_adds_pagination_params(self):
        cl = make_client_mock()
        cl.private_request.return_value = {
            "sections": [],
            "more_available": False,
        }
        cursor = json.dumps({"max_id": "cursor_abc", "page": 2, "media_ids": []})

        _fetch_sections(cl, "tags/test/sections/", {"tag_name": "test"}, cursor, 30)

        call_kwargs = cl.private_request.call_args
        data_arg = call_kwargs[1].get("data") or call_kwargs[0][1]
        assert data_arg.get("max_id") == "cursor_abc"
        assert data_arg.get("page") == 2

    def test_returns_none_cursor_when_no_more(self):
        cl = make_client_mock()
        cl.private_request.return_value = {"sections": [], "more_available": False}

        posts, cursor = _fetch_sections(cl, "endpoint/", {}, None, 30)
        assert cursor is None
        assert posts == []
