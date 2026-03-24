"""
Unit-тесты для utils.py — маппинг instagrapi-исключений в error_code и HTTP-статусы.
"""

import pytest
from instagrapi.exceptions import (
    ChallengeRequired,
    ClientThrottledError,
    FeedbackRequired,
    LoginRequired,
    PleaseWaitFewMinutes,
)

from utils import error_to_code, error_to_http_status


class TestErrorToCode:
    def test_challenge_required(self):
        assert error_to_code(ChallengeRequired()) == "challenge_required"

    def test_login_required(self):
        assert error_to_code(LoginRequired()) == "login_required"

    def test_please_wait_few_minutes(self):
        assert error_to_code(PleaseWaitFewMinutes()) == "rate_limited"

    def test_feedback_required(self):
        assert error_to_code(FeedbackRequired()) == "rate_limited"

    def test_client_throttled_error(self):
        assert error_to_code(ClientThrottledError()) == "rate_limited"

    def test_connect_timeout(self):
        try:
            from httpx import ConnectTimeout
            # ConnectTimeout требует request-аргумент
            exc = ConnectTimeout("timeout", request=None)
            assert error_to_code(exc) == "timeout"
        except ImportError:
            pytest.skip("httpx not available")

    def test_read_timeout(self):
        try:
            from httpx import ReadTimeout
            exc = ReadTimeout("timeout", request=None)
            assert error_to_code(exc) == "timeout"
        except ImportError:
            pytest.skip("httpx not available")

    def test_generic_exception(self):
        assert error_to_code(Exception("something went wrong")) == "error"

    def test_generic_exception_subclass(self):
        class CustomError(Exception):
            pass
        assert error_to_code(CustomError("custom")) == "error"


class TestErrorToHttpStatus:
    def test_rate_limited(self):
        assert error_to_http_status("rate_limited") == 429

    def test_challenge_required(self):
        assert error_to_http_status("challenge_required") == 401

    def test_login_required(self):
        assert error_to_http_status("login_required") == 401

    def test_timeout(self):
        assert error_to_http_status("timeout") == 504

    def test_generic_error(self):
        assert error_to_http_status("error") == 500

    def test_unknown_code(self):
        assert error_to_http_status("unknown_code") == 500
