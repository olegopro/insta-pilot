# План аудита Python-тестов (FastAPI + instagrapi) — insta-pilot

## Обзор текущего состояния

| Уровень | Фреймворк | Кол-во файлов | Расположение |
|---------|-----------|---------------|-------------|
| Unit | pytest + unittest.mock | 5 | `tests/unit/` |
| Integration | pytest + FastAPI TestClient | 1 | `tests/integration/` |
| Standalone (manual) | argparse + instagrapi | 1 | `test_feed_pagination.py` (корень) |
| Fixtures | conftest.py | 1 | `tests/conftest.py` |
| **Итого** | | **7 (+1 manual)** | |

**Конфигурация:** `pytest.ini` — asyncio_mode=auto, testpaths=tests, pythonpath=.
**Зависимости:** pytest 8.3.5, httpx 0.28.1, pytest-asyncio 0.25.3

---

## Раздел 1. Аудит unit-тестов (5 файлов, ~96 методов)

### 1.1 test_utils.py (76 строк, 16 тестов)

**Что тестирует:** Маппинг исключений instagrapi → error_code и error_code → HTTP status

| Класс | Тестов | Покрытие |
|-------|--------|----------|
| `TestErrorToCode` | 9 | ChallengeRequired, LoginRequired, PleaseWaitFewMinutes, FeedbackRequired, ClientThrottledError, ConnectTimeout, ReadTimeout, generic, subclass |
| `TestErrorToHttpStatus` | 6 | rate_limited→429, challenge→401, login_required→401, timeout→504, error→500, unknown→500 |

**Чек-лист:**
- [ ] Все исключения instagrapi покрыты (сравнить с `from instagrapi.exceptions import ...`)
- [ ] Нет ли пропущенных исключений: `TwoFactorRequired`, `BadPassword`, `ReloginAttemptExceeded`, `PrivateAccount`, `ClientNotFoundError`
- [ ] `ConnectTimeout` и `ReadTimeout` — из httpx, не из requests (проверить import)
- [ ] `error_to_http_status` — все коды из `error_to_code` имеют маппинг
- [ ] Edge case: `None` на входе в `error_to_code()`
- [ ] Edge case: пустая строка в `error_to_http_status()`

---

### 1.2 test_schemas.py (156 строк, 25 тестов)

**Что тестирует:** Pydantic-валидация request/response моделей

| Класс | Тестов | Схема |
|-------|--------|-------|
| `TestSessionRequest` | 2 | session_data required |
| `TestLoginRequest` | 4 | login, password required; device_profile optional |
| `TestFeedRequest` | 3 | session_data required; max_id, seen_posts, reason, min_posts optional |
| `TestSearchHashtagRequest` | 3 | hashtag required; amount default=30 |
| `TestCommentRequest` | 3 | media_id, text required |
| `TestFetchCommentsRequest` | 3 | media_pk required; min_id optional |
| `TestFetchCommentRepliesRequest` | 2 | media_pk, comment_pk required |
| `TestSearchLocationsRequest` | 2 | query required |
| `TestSearchLocationRequest` | 3 | location_pk required; amount default=30; next_max_id optional |

**Чек-лист:**
- [ ] Каждая Pydantic-модель из `schemas.py` имеет тестовый класс
- [ ] Required-поля: `pytest.raises(ValidationError)` при отсутствии
- [ ] Optional-поля: `None` по умолчанию, допускается пустое значение
- [ ] Default-значения проверяются (`amount=30`)
- [ ] Типы: невалидный тип (строка вместо int) → `ValidationError`?
- [ ] Response-схемы (`LoginResponse`, `FeedResponse` и др.) — тестируются ли?
- [ ] `UserInfoRequest` (user_pk) — есть ли тест?
- [ ] `MediaLikeRequest` (media_id, session_data) — есть ли тест?
- [ ] Nested models (device_profile внутри LoginRequest) — корректная валидация?
- [ ] Extra fields: `model_config = ConfigDict(extra='forbid')`? Тестируется ли?

---

### 1.3 test_lock.py (69 строк, 5 тестов)

**Что тестирует:** Per-account asyncio.Lock — сериализация запросов к одному аккаунту

| Тест | Async | Что проверяет |
|------|-------|---------------|
| `test_same_session_data_same_lock` | нет | Один session_data → один Lock (identity) |
| `test_different_session_data_different_locks` | нет | Разные session_data → разные Lock'и |
| `test_returns_asyncio_lock` | нет | Возвращает `asyncio.Lock` |
| `test_lock_serializes_requests_for_same_account` | да | Два coroutine с одним Lock — последовательно |
| `test_different_accounts_do_not_block_each_other` | да | Два coroutine с разными Lock'ами — параллельно |

**Чек-лист:**
- [ ] `clear_locks` fixture очищает `_locks` dict (изоляция между тестами)
- [ ] Async-тест: `@pytest.mark.asyncio` или `asyncio_mode=auto`
- [ ] Сериализация: проверяется порядок (end_A < start_B или end_B < start_A)
- [ ] Параллельность: оба start до обоих end
- [ ] Edge case: `account_lock("")` — пустая строка session_data
- [ ] Memory leak: растёт ли `_locks` dict бесконечно? Есть ли eviction?
- [ ] Thread safety: Lock работает только в asyncio (не threading) — документировано?

---

### 1.4 test_client.py (111 строк, 8 тестов)

**Что тестирует:** Кеширование instagrapi.Client — session_key (MD5), TTL, LRU eviction

| Класс | Тестов | Что проверяет |
|-------|--------|---------------|
| `TestSessionKey` | 3 | MD5 детерминирован, разные данные → разный ключ, hex-формат |
| `TestMakeClient` | 5 | Создание из session, кеш (identity), TTL expiry, LRU eviction, MAX=20 |

**Чек-лист:**
- [ ] `session_key()`: стабильный MD5 при разном порядке ключей JSON?
- [ ] `session_key()`: одинаковый результат для `json.dumps(data)` vs `json.dumps(data, sort_keys=True)`?
- [ ] Кеш: `cl1 is cl2` — identity check (не equality)
- [ ] TTL: после истечения создаётся новый Client (не возвращается expired)
- [ ] TTL: значение `_CLIENT_CACHE_TTL = 300` — адекватно?
- [ ] LRU eviction: при MAX=20 старейший вытесняется
- [ ] LRU: проверяется ли что вытесненный Client именно самый старый?
- [ ] Edge case: `_make_client()` с невалидным session_data JSON
- [ ] Edge case: concurrent вызовы `_make_client()` с одним session_data (race condition?)
- [ ] `set_settings()` вызывается на Client с распарсенным session_data
- [ ] Device settings из session_data применяются к Client?

---

### 1.5 test_helpers.py (506 строк, 43 теста)

**Что тестирует:** Сериализация медиа/комментариев, пагинация ленты, cursor-менеджмент

| Класс | Тестов | Функция |
|-------|--------|---------|
| `TestSerializeMedia` | 11 | `_serialize_media()` — нормализация медиа |
| `TestSerializeComment` | 4 | `_serialize_comment()` — нормализация комментариев |
| `TestExtractPosts` | 4 | `_extract_posts()` — извлечение из feed_items |
| `TestExtractSectionsPosts` | 4 | `_extract_sections_posts()` — извлечение из sections |
| `TestBuildPaginationParams` | 3 | `_build_pagination_params()` — POST-данные для пагинации |
| `TestInstagramResponseDebug` | 5 | `_instagram_response_debug()` — компактификация для логов |
| `TestSectionsCursor` | 5 | `_build_sections_cursor()` / `_parse_sections_cursor()` |
| `TestPaginateFeed` | 3 | `_paginate_feed()` — последовательная пагинация |
| `TestFetchSections` | 3 | `_fetch_sections()` — запрос sections endpoint |

**Чек-лист для TestSerializeMedia:**
- [ ] Все media_type: photo (1), video (2), carousel (8)
- [ ] Photo: `image_versions2.candidates[0].url` извлекается
- [ ] Video: `video_versions[0].url` извлекается
- [ ] Carousel: `carousel_media[]` → resources array с pk, media_type, urls
- [ ] None / empty dict → `None` (не crash)
- [ ] Missing `image_versions2` → thumbnail_url = None или fallback?
- [ ] None caption → пустая строка `""`
- [ ] Location: pk и name извлекаются; отсутствие location → null
- [ ] `taken_at` (unix) → ISO 8601 UTC
- [ ] `pk` (int) → string; `user.pk` (int) → string
- [ ] Edge case: carousel с 0 items
- [ ] Edge case: media без user (анонимный?)

**Чек-лист для TestSerializeComment:**
- [ ] Базовый комментарий со всеми полями
- [ ] `pk` (int) → string
- [ ] `preview_child_comments` → рекурсивная сериализация
- [ ] Missing user fields → не crash
- [ ] Edge case: `child_comment_count=0` + пустой `preview_child_comments`
- [ ] Edge case: очень длинный текст комментария

**Чек-лист для TestPaginateFeed:**
- [ ] Одна страница — все посты возвращены
- [ ] `min_posts` reached → stop
- [ ] `MAX_PAGINATION_ITERATIONS=5` → stop (infinite loop protection)
- [ ] Edge case: `more_available=False` на первой странице
- [ ] Edge case: дубликаты между страницами (проверяется ли dedupe?)
- [ ] Retry при ошибке (или нет retry — только max iterations?)
- [ ] `seen_posts` накапливается между итерациями?

**Чек-лист для TestSectionsCursor:**
- [ ] Build: cursor содержит max_id, page, media_ids
- [ ] Build: `more_available=False` → `None` cursor
- [ ] Build: отсутствие `next_max_id` → `None` cursor
- [ ] Parse: JSON cursor → dict с параметрами
- [ ] Parse: cursor без page/media_ids → defaults
- [ ] Edge case: невалидный JSON cursor → что происходит?

---

## Раздел 2. Аудит интеграционных тестов (1 файл, 44+ тестов)

**Файл:** `tests/integration/test_endpoints.py` (659 строк)

### 2.1 Endpoint coverage

| Endpoint | Метод | Тестов | Success | Error (401/422/429) |
|----------|-------|--------|---------|---------------------|
| `GET /health` | GET | 1 | 1 | — |
| `POST /auth/login` | POST | 6 | 1 | 3 (challenge, login_req, validation) + device_profile |
| `POST /account/info` | POST | 3 | 1 | 2 (login_req, validation) |
| `POST /account/feed` | POST | 5 | 2 (cold start, pagination) | 1 (rate_limit) + empty |
| `POST /media/like` | POST | 4 | 1 | 3 (rate_limit, login_req, validation) |
| `POST /media/comment` | POST | 3 | 1 | 2 (validation, challenge) |
| `POST /user/info` | POST | 3 | 1 | 2 (validation, login_req) |
| `POST /search/hashtag` | POST | 5 | 1 | 2 (validation, rate_limit) + empty + encoding |
| `POST /search/locations` | POST | 3 | 1 | 1 (validation) + empty |
| `POST /search/location` | POST | 3 | 1 | 2 (validation, login_req) |
| `POST /media/comments` | POST | 5 | 2 (basic, pagination) | 1 (validation) + empty |
| `POST /media/comments/replies` | POST | 3 | 1 | 2 (validation, login_req) |
| **Parametrized** | — | 2+ | — | LoginRequired + ChallengeRequired across endpoints |

### 2.2 Чек-лист для каждого endpoint-теста

**Success-кейс:**
- [ ] HTTP 200
- [ ] Response body: `{ success: true, ... }`
- [ ] Ключевые поля data проверяются (не только `success`)
- [ ] Mock правильно настроен (правильный метод Client вызывается)
- [ ] `assert_called_once_with()` — проверяются аргументы вызова

**Error-кейсы:**
- [ ] 401 для `ChallengeRequired`, `LoginRequired`
- [ ] 429 для `PleaseWaitFewMinutes`, `FeedbackRequired`, `ClientThrottledError`
- [ ] 422 для невалидного Pydantic input
- [ ] 500 для generic exceptions
- [ ] 504 для timeout
- [ ] Response body содержит `error_code` и `message`
- [ ] Traceback НЕ раскрывается в response

**Мокирование:**
- [ ] `unittest.mock.patch` — правильный путь к мокируемому объекту
- [ ] `MagicMock` для Client — все необходимые методы замоканы
- [ ] `side_effect` для имитации исключений
- [ ] Мок не "слишком жадный" (не скрывает реальные баги)

### 2.3 Специфические проверки

**Login endpoint:**
- [ ] `Client.login()` вызывается с login + password
- [ ] `Client.get_settings()` возвращает session_data (для сохранения)
- [ ] `device_profile` → `set_device()` + `set_user_agent()` вызываются
- [ ] Proxy из запроса → `Client.set_proxy()` вызывается?

**Feed endpoint:**
- [ ] Cold start: `get_timeline_feed()` (без max_id)
- [ ] Pagination: `private_request()` с POST data (max_id, seen_posts, feed_view_info)
- [ ] Empty feed → корректный пустой ответ (не ошибка)
- [ ] `more_available` и `next_max_id` корректно извлекаются

**Search hashtag:**
- [ ] Кириллический хэштег корректно URL-encode'ится
- [ ] `amount` параметр передаётся
- [ ] Pagination через `next_max_id` (cursor-based)

**Media comments:**
- [ ] `min_id` pagination передаётся в `private_request()`
- [ ] `comment_count` возвращается из response

---

## Раздел 3. Аудит conftest.py и fixtures

**Файл:** `tests/conftest.py` (92 строки)

### 3.1 Fixtures

| Fixture | Scope | Что предоставляет |
|---------|-------|-------------------|
| `session_data` | function | SAMPLE_SESSION_DATA — полный JSON сессии instagrapi |
| `session_data_2` | function | Второй session_data (другие UUID, user_id) |
| `app_client` | function | `TestClient(app)` — FastAPI TestClient |

**Чек-лист:**
- [ ] `session_data` содержит все обязательные поля для `Client.set_settings()`
- [ ] UUIDs реалистичны (формат UUID4)
- [ ] Cookies: `csrftoken`, `ds_user_id`, `sessionid` — присутствуют
- [ ] Device settings: `app_version`, `android_version`, `manufacturer`, `model` — присутствуют
- [ ] `session_data_2` — достаточно отличается от `session_data` (другой user_id, UUID)
- [ ] `app_client` — scope=function (изоляция между тестами)
- [ ] Нет реальных Instagram credentials в fixtures
- [ ] Нет реальных cookies/tokens в fixtures

### 3.2 Фабрики (inline helpers в test_helpers.py)

| Helper | Где используется | Что создаёт |
|--------|-----------------|-------------|
| `make_media()` | test_helpers.py | Минимальный Media dict |
| `make_comment()` | test_helpers.py | Минимальный Comment dict |
| `make_client_mock()` | test_helpers.py | MagicMock Client с атрибутами |
| `make_mock_client()` | test_endpoints.py | MagicMock Client для endpoint-тестов |
| `make_media_raw()` | test_endpoints.py | Raw media dict (как от Instagram) |
| `make_comment_raw()` | test_endpoints.py | Raw comment dict |

**Чек-лист:**
- [ ] Фабрики принимают overrides (кастомизация полей)
- [ ] Нет дублирования между `make_media()` (unit) и `make_media_raw()` (integration)
- [ ] `make_client_mock()` содержит все атрибуты, которые реальный Client имеет
- [ ] Фабрики переиспользуются (не копируются из теста в тест)

---

## Раздел 4. Аудит standalone-теста

**Файл:** `test_feed_pagination.py` (221 строка, корень python-service/)

### 4.1 Что проверить

- [ ] Не входит в pytest suite (не в `tests/`)
- [ ] Требует реального session JSON файла — документировано?
- [ ] Использует `argparse` — CLI-интерфейс
- [ ] Параметры: `--pages`, `--delay-min`, `--delay-max`
- [ ] Проверяет дубликаты между страницами
- [ ] Delay между страницами — anti-bot measure
- [ ] **Решение:** переместить в `tests/manual/` или `scripts/`?
- [ ] **Безопасность:** не коммитит session JSON файлы в git?

---

## Раздел 5. Кросс-уровневый анализ

### 5.1 Покрытие по модулям приложения

| Модуль | Unit | Integration | Что может быть пропущено |
|--------|------|-------------|--------------------------|
| `main.py` (endpoints) | — | 44+ тестов | Все endpoints покрыты |
| `utils.py` (errors) | 16 тестов | Через integration | Пропущенные exception types |
| `schemas.py` (Pydantic) | 25 тестов | Через integration | Response-схемы, extra fields |
| `lock.py` (asyncio Lock) | 5 тестов | — | Memory leak, eviction |
| `client.py` (Client cache) | 8 тестов | — | Concurrent access, invalid JSON |
| `helpers.py` (serialization) | 43 теста | Через integration | Edge cases carousel, dedupe |

### 5.2 Непокрытые области

- [ ] **Response-схемы** (Pydantic): `LoginResponse`, `FeedResponse` и др. — нет unit-тестов
- [ ] **Middleware/CORS**: настройки CORS в `main.py` — тестируются?
- [ ] **Startup/shutdown events**: lifespan events — тестируются?
- [ ] **Concurrent requests**: два запроса к одному аккаунту — Lock работает?
- [ ] **Timeout handling**: таймауты HTTP-запросов к Instagram — тестируются?
- [ ] **Logging**: структурированное логирование — корректность формата?
- [ ] **Proxy**: `Client.set_proxy()` — тестируется в endpoints?
- [ ] **Device profile**: `set_device()` + `set_user_agent()` — покрыт только в login

### 5.3 Мок-стратегия

| Что мокируется | Где | Как |
|----------------|-----|-----|
| `instagrapi.Client` | test_endpoints.py, test_helpers.py | `unittest.mock.patch` + `MagicMock` |
| `Client.login()` | test_endpoints.py | `MagicMock.return_value` |
| `Client.get_timeline_feed()` | test_endpoints.py | `MagicMock.return_value` |
| `Client.private_request()` | test_endpoints.py, test_helpers.py | `MagicMock.return_value` / `side_effect` |
| `Client.media_like()` | test_endpoints.py | `MagicMock.return_value` |
| `_make_client()` | test_endpoints.py | `patch('main._make_client')` |
| `account_lock()` | test_endpoints.py | `patch` с AsyncMock? |

**Чек-лист мок-стратегии:**
- [ ] `patch` path корректен (мокируется где импортируется, не где определяется)
- [ ] `MagicMock` vs `AsyncMock` — async-методы мокируются через `AsyncMock`?
- [ ] `side_effect` для исключений — правильный тип исключения (instagrapi, не generic)
- [ ] Нет "мёртвых" моков (mock настроен, но assertion не проверяется)
- [ ] Mock return value реалистичен (структура как у реального Instagram API)

---

## Раздел 6. Качество и паттерны

### 6.1 Code quality

- [ ] Имена тестов: `test_<what>_<expectation>` — информативны
- [ ] Один assert concern на тест (не mega-тесты)
- [ ] `pytest.raises()` для ожидаемых исключений
- [ ] Fixtures vs inline setup — нет дублирования
- [ ] Async-тесты корректно оформлены (`asyncio_mode=auto`)
- [ ] `autouse=True` fixtures для cleanup (clear_locks, clear_cache)

### 6.2 Parametrize

- [ ] `TestCommonErrorBehavior` использует `@pytest.mark.parametrize` — все endpoints покрыты?
- [ ] Можно ли расширить parametrize на validation-тесты (422)?
- [ ] Можно ли parametrize rate_limit тесты по всем endpoints?

### 6.3 Соответствие конвенциям проекта (CLAUDE.md)

- [ ] Все ошибки обёрнуты в предсказуемый API-ответ (без traceback наружу)
- [ ] Сессии переиспользуются через `session_data` JSON
- [ ] Прокси задаются до авторизации
- [ ] Не логируются: пароль, cookie, full session dump
- [ ] Суффикс `_pk` — числовой ID, `_id` — составной

### 6.4 Python-specific checks

- [ ] Type hints в тестах (optional, но полезно)
- [ ] `requirements-dev.txt` — все test-зависимости перечислены
- [ ] Python 3.10+ requirement (union syntax `Type | Type` в instagrapi) — документирован?
- [ ] `__init__.py` во всех test-директориях (для pytest discovery)
- [ ] Нет `import *` в тестах

---

## Раздел 7. Безопасность в тестах

### 7.1 Проверки безопасности

- [ ] Нет реальных Instagram credentials в тестах / fixtures
- [ ] Нет реальных session cookies в conftest.py (фейковые UUID/token)
- [ ] `test_feed_pagination.py` — session file не коммитится в git (`.gitignore`)
- [ ] Traceback не раскрывается в API-ответах (тестируется ли?)
- [ ] Sensitive data (password, session_data) не логируется (тестируется ли?)
- [ ] SSRF: нет endpoint'ов принимающих произвольный URL для fetch
- [ ] Rate limiting: API не позволяет злоупотребление (тестируется ли?)

### 7.2 Чувствительные данные

- [ ] `SAMPLE_SESSION_DATA` — фейковые UUID, не от реального аккаунта
- [ ] `ds_user_id`, `sessionid` — фейковые значения
- [ ] Нет `.env` файлов с production данными в tests/
- [ ] `_TEST/fixtures/` (упомянут в integration тесте Laravel) — что там?

---

## Раздел 8. Рекомендации и action items

### 8.1 Высокий приоритет

- [ ] Проверить все endpoint-тесты: каждый error_code маппится на правильный HTTP status
- [ ] Проверить пропущенные исключения instagrapi (`TwoFactorRequired`, `BadPassword`, `PrivateAccount`)
- [ ] Проверить что traceback никогда не утекает в response (тест на generic exception)
- [ ] Проверить async Lock — нет ли deadlock при ошибке внутри lock context
- [ ] Проверить Client cache — race condition при concurrent `_make_client()`

### 8.2 Средний приоритет

- [ ] Добавить тесты Response-схем (Pydantic output validation)
- [ ] Расширить `@pytest.mark.parametrize` на все endpoints (422, 429, 401)
- [ ] Добавить тесты proxy-прокидывания (`set_proxy()` вызывается до login)
- [ ] Добавить тесты CORS-заголовков
- [ ] Переместить `test_feed_pagination.py` в `tests/manual/` или `scripts/`
- [ ] Вынести фабрики (`make_media`, `make_comment`) в общий `tests/factories.py`

### 8.3 Низкий приоритет

- [ ] Настроить coverage (`pytest-cov`) с порогом
- [ ] Добавить `conftest.py` в `tests/unit/` и `tests/integration/` для scope-specific fixtures
- [ ] Рассмотреть `hypothesis` для property-based testing serialization
- [ ] CI pipeline: `pytest tests/` в Docker (python-service контейнер)
- [ ] Добавить `@pytest.mark.slow` для тяжёлых тестов

---

## Порядок выполнения аудита

| Этап | Действие | Приоритет |
|------|----------|-----------|
| 1 | Запустить все тесты (`pytest tests/`), зафиксировать pass/fail | Высокий |
| 2 | Аудит endpoint-тестов (раздел 2) — API contract, error codes | Высокий |
| 3 | Аудит test_helpers.py (раздел 1.5) — сериализация, пагинация | Высокий |
| 4 | Аудит test_utils.py (раздел 1.1) — маппинг ошибок, полнота | Высокий |
| 5 | Аудит безопасности (раздел 7) — credentials, traceback | Высокий |
| 6 | Аудит test_schemas.py (раздел 1.2) — Pydantic-валидация | Средний |
| 7 | Аудит test_client.py (раздел 1.4) — кеширование, TTL, LRU | Средний |
| 8 | Аудит test_lock.py (раздел 1.3) — async Lock, изоляция | Средний |
| 9 | Кросс-уровневый анализ покрытия (раздел 5) | Средний |
| 10 | Аудит conftest.py и фабрик (раздел 3) | Низкий |
| 11 | Code quality и паттерны (раздел 6) | Низкий |
| 12 | Формирование итогового отчёта с рекомендациями | Финал |
