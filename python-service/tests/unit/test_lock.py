"""
Unit-тесты для lock.py — asyncio.Lock по session_data аккаунта.
"""

import asyncio

import pytest

import lock as lock_module
from lock import account_lock


@pytest.fixture(autouse=True)
def clear_locks():
    """Очищает словарь локов перед каждым тестом."""
    lock_module._locks.clear()
    yield
    lock_module._locks.clear()


class TestAccountLock:
    def test_same_session_data_same_lock(self, session_data):
        lock1 = account_lock(session_data)
        lock2 = account_lock(session_data)
        assert lock1 is lock2

    def test_different_session_data_different_locks(self, session_data, session_data_2):
        lock1 = account_lock(session_data)
        lock2 = account_lock(session_data_2)
        assert lock1 is not lock2

    def test_returns_asyncio_lock(self, session_data):
        lock = account_lock(session_data)
        assert isinstance(lock, asyncio.Lock)

    def test_empty_string_returns_lock(self):
        lock = account_lock("")
        assert isinstance(lock, asyncio.Lock)

    async def test_lock_serializes_requests_for_same_account(self, session_data):
        """Два корутина с одним аккаунтом не выполняются одновременно."""
        lock = account_lock(session_data)
        results = []

        async def task(label: str):
            async with lock:
                results.append(f"start_{label}")
                await asyncio.sleep(0.01)
                results.append(f"end_{label}")

        await asyncio.gather(task("A"), task("B"))

        # Правильный порядок: A полностью завершается до B (или B до A)
        assert results.index("end_A") < results.index("start_B") or \
               results.index("end_B") < results.index("start_A")

    async def test_different_accounts_do_not_block_each_other(self, session_data, session_data_2):
        """Два аккаунта работают параллельно без блокировки."""
        lock1 = account_lock(session_data)
        lock2 = account_lock(session_data_2)
        results = []

        async def task(lock: asyncio.Lock, label: str):
            async with lock:
                results.append(f"start_{label}")
                await asyncio.sleep(0.05)
                results.append(f"end_{label}")

        await asyncio.gather(task(lock1, "A"), task(lock2, "B"))

        # Оба start-а должны произойти до обоих end-ов (параллельное выполнение)
        assert results.index("start_A") < results.index("end_B")
        assert results.index("start_B") < results.index("end_A")
