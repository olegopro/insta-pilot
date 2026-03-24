"""
Общие fixtures для всех тестов Python-сервиса.
"""

import json
import pytest
from fastapi.testclient import TestClient


# Минимальный session_data — структура, которую принимает instagrapi Client.set_settings()
SAMPLE_SESSION_DATA = json.dumps({
    "uuids": {
        "phone_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "uuid": "ffffffff-0000-1111-2222-333333333333",
        "client_session_id": "11111111-2222-3333-4444-555555555555",
        "advertising_id": "66666666-7777-8888-9999-aaaaaaaaaaaa",
        "device_id": "android-bbbbbbbbbbbbbbbb",
    },
    "cookies": {"csrftoken": "testtoken", "ds_user_id": "123456789", "sessionid": "test_session_id"},
    "last_login": 1700000000.0,
    "device_settings": {
        "app_version": "269.0.0.18.75",
        "android_version": 28,
        "android_release": "9.0",
        "dpi": "480dpi",
        "resolution": "1080x2154",
        "manufacturer": "Samsung",
        "device": "SM-G965F",
        "model": "star2qltecs",
        "cpu": "qcom",
        "version_code": "314665256",
    },
    "user_agent": "Instagram 269.0.0.18.75 Android (28/9.0; 480dpi; 1080x2154; samsung; SM-G965F; star2qltecs; qcom; en_US; 314665256)",
    "country": "US",
    "country_code": 1,
    "locale": "en_US",
    "timezone_offset": -14400,
    "authorization_data": {
        "ds_user_id": "123456789",
        "sessionid": "test_session_id",
    },
})

SAMPLE_SESSION_DATA_2 = json.dumps({
    "uuids": {
        "phone_id": "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
        "uuid": "00000000-1111-2222-3333-444444444444",
        "client_session_id": "22222222-3333-4444-5555-666666666666",
        "advertising_id": "77777777-8888-9999-aaaa-bbbbbbbbbbbb",
        "device_id": "android-cccccccccccccccc",
    },
    "cookies": {"csrftoken": "testtoken2", "ds_user_id": "987654321", "sessionid": "test_session_id_2"},
    "last_login": 1700000000.0,
    "device_settings": {
        "app_version": "269.0.0.18.75",
        "android_version": 28,
        "android_release": "9.0",
        "dpi": "480dpi",
        "resolution": "1080x2154",
        "manufacturer": "Samsung",
        "device": "SM-G960F",
        "model": "starlte",
        "cpu": "qcom",
        "version_code": "314665256",
    },
    "user_agent": "Instagram 269.0.0.18.75 Android (28/9.0; 480dpi; 1080x2154; samsung; SM-G960F; starlte; qcom; en_US; 314665256)",
    "country": "US",
    "country_code": 1,
    "locale": "en_US",
    "timezone_offset": -14400,
    "authorization_data": {
        "ds_user_id": "987654321",
        "sessionid": "test_session_id_2",
    },
})


@pytest.fixture
def session_data() -> str:
    return SAMPLE_SESSION_DATA


@pytest.fixture
def session_data_2() -> str:
    return SAMPLE_SESSION_DATA_2


@pytest.fixture
def app_client():
    from main import app
    return TestClient(app)
