from instagrapi.exceptions import (
    ChallengeRequired,
    LoginRequired,
    PleaseWaitFewMinutes,
    FeedbackRequired,
    ClientThrottledError,
)

try:
    from httpx import ConnectTimeout, ReadTimeout
    _TIMEOUT_EXCEPTIONS = (ConnectTimeout, ReadTimeout)
except ImportError:
    _TIMEOUT_EXCEPTIONS = ()


def error_to_code(exc: Exception) -> str:
    if isinstance(exc, ChallengeRequired):
        return 'challenge_required'
    if isinstance(exc, LoginRequired):
        return 'login_required'
    if isinstance(exc, (PleaseWaitFewMinutes, FeedbackRequired, ClientThrottledError)):
        return 'rate_limited'
    if _TIMEOUT_EXCEPTIONS and isinstance(exc, _TIMEOUT_EXCEPTIONS):
        return 'timeout'
    return 'error'


def error_to_http_status(error_code: str) -> int:
    mapping = {
        'rate_limited': 429,
        'challenge_required': 401,
        'login_required': 401,
        'timeout': 504,
    }
    return mapping.get(error_code, 500)
