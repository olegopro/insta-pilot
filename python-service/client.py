import hashlib
import json
import time
from typing import Optional

from instagrapi import Client


# Кеш активных клиентов: md5(session_data) → (Client, timestamp создания)
_client_cache: dict[str, tuple[Client, float]] = {}

# Время жизни записи в кеше (секунды)
_CLIENT_CACHE_TTL = 300

# Максимальное число одновременно хранимых клиентов
_CLIENT_CACHE_MAX = 5


def _make_client(session_data: str, proxy: Optional[str] = None) -> Client:
    """
    Возвращает Client из кеша или создаёт новый на основе session_data.

    Кеш ограничен по размеру (_CLIENT_CACHE_MAX) и времени жизни (_CLIENT_CACHE_TTL).
    При переполнении вытесняется самая старая запись.
    """
    cache_key = hashlib.md5(session_data.encode()).hexdigest()
    now = time.time()

    # Возвращаем из кеша, если запись ещё не устарела
    if cache_key in _client_cache:
        cl, created_at = _client_cache[cache_key]
        if now - created_at < _CLIENT_CACHE_TTL:
            return cl
        # TTL истёк — удаляем протухшую запись
        del _client_cache[cache_key]

    # Кеш переполнен — вытесняем самый старый элемент (LRU by creation time)
    if len(_client_cache) >= _CLIENT_CACHE_MAX:
        oldest_key = min(_client_cache, key=lambda k: _client_cache[k][1])
        del _client_cache[oldest_key]

    # Создаём новый клиент и восстанавливаем сессию из JSON
    cl = Client()
    if proxy:
        cl.set_proxy(proxy)
    cl.set_settings(json.loads(session_data))

    _client_cache[cache_key] = (cl, now)
    return cl
