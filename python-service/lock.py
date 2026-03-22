"""
Управление asyncio.Lock-ами для Instagram-аккаунтов.

Гарантирует, что для одного аккаунта выполняется не более одного
instagrapi-запроса одновременно. Разные аккаунты работают независимо.

Работает только при одном uvicorn worker-е (--workers 1):
asyncio.Lock живёт в памяти одного процесса и привязан к его event loop.
"""

import asyncio

from client import session_key

# session_key(session_data) → asyncio.Lock
# dict-операции атомарны в CPython — race condition в однопоточном event loop невозможен
_locks: dict[str, asyncio.Lock] = {}


def account_lock(session_data: str) -> asyncio.Lock:
    """Возвращает asyncio.Lock для конкретного аккаунта (по md5 session_data)."""
    key = session_key(session_data)
    if key not in _locks:
        _locks[key] = asyncio.Lock()
    return _locks[key]
