"""
Unit-тесты чистых helper-ов parse targets.
"""

import datetime

from helpers import _compute_target_metrics, _dedup_candidates_by_author


class TestComputeTargetMetrics:
    def test_computes_likes_and_last_post_age(self):
        now = datetime.datetime(2026, 6, 21, tzinfo=datetime.timezone.utc)
        posts = [
            {
                "taken_at": "2026-06-18T12:00:00+00:00",
                "like_count": 10,
                "caption_text": "First caption",
            },
            {
                "taken_at": "2026-06-10T12:00:00+00:00",
                "like_count": 30,
                "caption_text": "Second caption",
            },
            {
                "taken_at": "2026-06-01T12:00:00+00:00",
                "like_count": 5,
                "caption_text": "",
            },
        ]

        result = _compute_target_metrics(posts, now)

        assert result["last_post_age_days"] == 2
        assert result["likes_sum_last_n"] == 45
        assert result["likes_avg_last_n"] == 15
        assert result["likes_min"] == 5
        assert result["likes_max"] == 30
        assert result["posts_analyzed"] == 3
        assert result["captions_concat"] == "First caption\nSecond caption"

    def test_empty_posts_returns_zero_metrics(self):
        now = datetime.datetime(2026, 6, 21, tzinfo=datetime.timezone.utc)

        result = _compute_target_metrics([], now)

        assert result["last_post_age_days"] is None
        assert result["likes_sum_last_n"] == 0
        assert result["likes_avg_last_n"] == 0
        assert result["likes_min"] == 0
        assert result["likes_max"] == 0
        assert result["posts_analyzed"] == 0
        assert result["captions_concat"] == ""

    def test_invalid_taken_at_keeps_age_none(self):
        now = datetime.datetime(2026, 6, 21, tzinfo=datetime.timezone.utc)

        result = _compute_target_metrics([{"taken_at": "bad-date", "like_count": 7}], now)

        assert result["last_post_age_days"] is None
        assert result["likes_sum_last_n"] == 7


class TestDedupCandidatesByAuthor:
    def test_keeps_first_post_per_author_and_updates_seen(self):
        seen_pks = {"100"}
        posts = [
            {"pk": "post-1", "user": {"pk": "100", "username": "seen"}},
            {"pk": "post-2", "user": {"pk": "200", "username": "first"}},
            {"pk": "post-3", "user": {"pk": "200", "username": "duplicate"}},
            {"pk": "post-4", "user": {"pk": "300", "username": "second"}},
        ]

        result = _dedup_candidates_by_author(posts, seen_pks)

        assert result == [
            {
                "user_pk": "200",
                "username": "first",
                "anchor_post": posts[1],
            },
            {
                "user_pk": "300",
                "username": "second",
                "anchor_post": posts[3],
            },
        ]
        assert seen_pks == {"100", "200", "300"}

    def test_skips_posts_without_author_pk(self):
        result = _dedup_candidates_by_author([
            {"pk": "post-1", "user": {}},
            {"pk": "post-2"},
        ], set())

        assert result == []
