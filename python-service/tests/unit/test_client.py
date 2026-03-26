"""
Unit-тесты для client.py — кеш instagrapi Client.
"""

import json
import time
from unittest.mock import MagicMock, patch

import pytest

import client as client_module
from client import _make_client, session_key


@pytest.fixture(autouse=True)
def clear_cache():
    """Очищает кеш клиентов перед каждым тестом."""
    client_module._client_cache.clear()
    yield
    client_module._client_cache.clear()


MINIMAL_SESSION = json.dumps({
    "uuids": {
        "phone_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "uuid": "ffffffff-0000-1111-2222-333333333333",
        "client_session_id": "11111111-2222-3333-4444-555555555555",
        "advertising_id": "66666666-7777-8888-9999-aaaaaaaaaaaa",
        "device_id": "android-bbbbbbbbbbbbbbbb",
    },
    "cookies": {},
    "last_login": 0,
    "device_settings": {},
    "user_agent": "",
    "country": "US",
    "country_code": 1,
    "locale": "en_US",
    "timezone_offset": 0,
    "authorization_data": {},
})


class TestSessionKey:
    def test_stable_md5(self):
        key1 = session_key('{"test": 1}')
        key2 = session_key('{"test": 1}')
        assert key1 == key2

    def test_different_data_different_key(self):
        key1 = session_key('{"user": "alice"}')
        key2 = session_key('{"user": "bob"}')
        assert key1 != key2

    def test_returns_hex_string(self):
        key = session_key('data')
        assert len(key) == 32
        assert all(c in "0123456789abcdef" for c in key)

    def test_key_depends_on_string_ordering(self):
        # session_key хэширует строку дословно — порядок ключей JSON влияет на ключ кеша
        key1 = session_key('{"a": 1, "b": 2}')
        key2 = session_key('{"b": 2, "a": 1}')
        assert key1 != key2


class TestMakeClient:
    def test_creates_client_from_session_data(self):
        cl = _make_client(MINIMAL_SESSION)
        assert cl is not None

    def test_caches_client_on_second_call(self):
        cl1 = _make_client(MINIMAL_SESSION)
        cl2 = _make_client(MINIMAL_SESSION)
        assert cl1 is cl2

    def test_creates_new_client_after_ttl(self):
        cl1 = _make_client(MINIMAL_SESSION)

        # Сдвигаем время создания на прошлое (> TTL)
        key = session_key(MINIMAL_SESSION)
        _, created_at = client_module._client_cache[key]
        client_module._client_cache[key] = (cl1, created_at - client_module._CLIENT_CACHE_TTL - 1)

        cl2 = _make_client(MINIMAL_SESSION)
        assert cl2 is not cl1

    def test_evicts_oldest_when_cache_full(self):
        original_max = client_module._CLIENT_CACHE_MAX
        client_module._CLIENT_CACHE_MAX = 3
        try:
            sessions = []
            for i in range(3):
                sd = json.dumps({"uuids": {"phone_id": f"id-{i}"}, "cookies": {},
                                 "last_login": 0, "device_settings": {}, "user_agent": "",
                                 "country": "US", "country_code": 1, "locale": "en_US",
                                 "timezone_offset": 0, "authorization_data": {}})
                sessions.append(sd)
                _make_client(sd)
                time.sleep(0.01)  # чтобы created_at различались

            first_key = session_key(sessions[0])
            assert first_key in client_module._client_cache

            # Добавляем 4-й — должен вытеснить первый
            sd_new = json.dumps({"uuids": {"phone_id": "id-new"}, "cookies": {},
                                 "last_login": 0, "device_settings": {}, "user_agent": "",
                                 "country": "US", "country_code": 1, "locale": "en_US",
                                 "timezone_offset": 0, "authorization_data": {}})
            _make_client(sd_new)

            assert len(client_module._client_cache) == 3
            assert first_key not in client_module._client_cache
        finally:
            client_module._CLIENT_CACHE_MAX = original_max

    def test_cache_max_is_20(self):
        assert client_module._CLIENT_CACHE_MAX == 20

    def test_invalid_session_data_raises(self):
        with pytest.raises(json.JSONDecodeError):
            _make_client("not-valid-json{")
