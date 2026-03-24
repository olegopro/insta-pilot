# Testing Plan — insta-pilot

Подробный план по полному покрытию тестами: unit, integration, e2e.

---

## Содержание

1. [Текущее состояние](#1-текущее-состояние)
2. [Архитектура тестирования](#2-архитектура-тестирования)
3. [Python Service — план тестов](#3-python-service--план-тестов)
4. [Backend Laravel — план тестов](#4-backend-laravel--план-тестов)
5. [Frontend Vue — план тестов](#5-frontend-vue--план-тестов)
6. [E2E тесты (Playwright)](#6-e2e-тесты-playwright)
7. [Интеграционные тесты (cross-service)](#7-интеграционные-тесты-cross-service)
8. [Порядок выполнения](#8-порядок-выполнения)
9. [Запуск тестов](#9-запуск-тестов)
10. [Fixtures и тестовые данные](#10-fixtures-и-тестовые-данные)

---

## 1. Текущее состояние

### Что покрыто

| Слой | Файлов с тестами | Тестов | Покрытие |
|------|-----------------|--------|----------|
| Backend Laravel | 4 | 32 | ~15% |
| Frontend Vue (unit) | 6 | 34 | ~12% |
| Frontend Vue (e2e) | 2 | 6 | ~5% |
| Python FastAPI | 0 | 0 | 0% |

### Backend — что есть

- `tests/Feature/Auth/AuthTest.php` — 9 тестов (register, login, logout, me)
- `tests/Feature/InstagramAccount/InstagramAccountTest.php` — 9 тестов (CRUD, login, device-profiles)
- `tests/Feature/Admin/AdminUserTest.php` — 10 тестов (index, toggleActive, updateRole)
- `tests/Unit/UserRepositoryTest.php` — 4 теста (all, findById, toggleActive, updateRole)

### Frontend — что есть

- `shared/api/__tests__/useApi.spec.ts` — 6 тестов
- `entities/user/model/__tests__/authStore.spec.ts` — 10 тестов
- `entities/user/model/__tests__/adminUsersStore.spec.ts` — 5 тестов
- `entities/user/model/__tests__/adminUsersListDTO.spec.ts` — 5 тестов
- `entities/instagram-account/model/__tests__/instagramAccountListDTO.spec.ts` — 3 тестов
- `features/auth-login/ui/__tests__/LoginForm.spec.ts` — 5 тестов
- `e2e/auth.spec.ts` — 4 теста
- `e2e/admin-users.spec.ts` — 2 теста

### Python — что есть

- `test_feed_pagination.py` — ручной скрипт, не pytest

---

## 2. Архитектура тестирования

### Три уровня тестов

```
E2E (Playwright)          — полный стек через браузер
  ↑
Integration               — взаимодействие между сервисами / слоями
  ↑
Unit                      — изолированная логика одного модуля
```

### Стек по слоям

| Слой | Framework | Config | Команда запуска |
|------|-----------|--------|-----------------|
| Python | pytest + httpx (TestClient) | `pytest.ini` / `conftest.py` | `pytest` |
| Laravel | PHPUnit 11 | `phpunit.xml` | `php artisan test` |
| Vue unit | Vitest + @vue/test-utils | `vitest.config.ts` | `npm run test:unit` |
| Vue e2e | Playwright | `playwright.config.ts` | `npm run test:e2e` |

### Принципы

- **Внешние API (Instagram, LLM) — всегда мокать** на уровне unit и integration тестов
- **HTTP между сервисами** — мокать в unit-тестах, реально вызывать в integration
- **БД** — SQLite in-memory для Laravel unit/feature, PostgreSQL для integration
- **Redis/Queue** — `QUEUE_CONNECTION=sync` в тестах Laravel
- **WebSocket** — мокать `broadcast()` в unit, проверять в e2e
- **Тестовые данные от Instagram** — получать через DEBUG_PROTOCOL.md, сохранять как fixtures в `_TEST/fixtures/`

---

## 3. Python Service — план тестов

### 3.1. Инфраструктура (создать с нуля)

```
python-service/
├── tests/
│   ├── conftest.py           # fixtures: TestClient, mock_client, session_data
│   ├── fixtures/             # JSON-снимки реальных ответов Instagram
│   │   ├── feed_response.json
│   │   ├── hashtag_response.json
│   │   ├── comments_response.json
│   │   └── user_info_response.json
│   ├── unit/
│   │   ├── test_client.py
│   │   ├── test_helpers.py
│   │   ├── test_utils.py
│   │   ├── test_lock.py
│   │   └── test_schemas.py
│   └── integration/
│       └── test_endpoints.py
├── pytest.ini
└── requirements-dev.txt      # pytest, httpx, pytest-asyncio
```

**Зависимости добавить:**
```
pytest==8.3.5
httpx==0.28.1
pytest-asyncio==0.25.3
```

### 3.2. Unit-тесты Python

#### `test_client.py` — кеш клиентов (5 тестов)
- `_make_client` восстанавливает Client из session_data JSON
- `session_key` возвращает стабильный MD5
- LRU кеш отдаёт тот же клиент при повторном вызове
- Кеш создаёт новый клиент после TTL
- Максимум 20 клиентов в кеше

#### `test_helpers.py` — сериализация и парсинг (15+ тестов)
- `_serialize_media()` — нормализует поля медиа (pk, id, code, media_type, user, resources, location)
- `_serialize_media()` — обрабатывает None/отсутствующие поля
- `_serialize_comment()` — нормализует комментарий (pk, text, user, preview_child_comments)
- `_extract_posts()` — извлекает посты из feed_items
- `_extract_sections_posts()` — извлекает посты из sections-формата (хэштеги, гео)
- `_build_pagination_params()` — собирает корректные параметры пагинации с seen_posts
- `_instagram_response_debug()` — компактный лог без чувствительных данных
- `_paginate_feed()` — мок private_request, проверить логику пагинации
- `_fetch_sections()` — мок private_request, проверить sections-пагинацию

#### `test_utils.py` — маппинг ошибок (8 тестов)
- `error_to_code(ChallengeRequired)` → `"challenge_required"`
- `error_to_code(LoginRequired)` → `"login_required"`
- `error_to_code(PleaseWaitFewMinutes)` → `"rate_limited"`
- `error_to_code(ClientThrottledError)` → `"rate_limited"`
- `error_to_code(ConnectTimeout)` → `"timeout"`
- `error_to_code(ReadTimeout)` → `"timeout"`
- `error_to_code(Exception)` → `"error"`
- `error_to_http_status()` — корректные HTTP-коды

#### `test_lock.py` — блокировки (4 теста)
- `account_lock` возвращает один Lock для одного session_data
- Разные session_data → разные Lock
- Lock сериализует запросы к одному аккаунту (asyncio)
- Разные аккаунты не блокируют друг друга

#### `test_schemas.py` — валидация Pydantic (6 тестов)
- `LoginRequest` — обязательные поля login, password
- `FeedRequest` — опциональные max_id, seen_posts, min_posts
- `SearchHashtagRequest` — обязательный hashtag, опциональный amount
- `CommentRequest` — обязательные media_id, text
- `SessionRequest` — обязательный session_data
- Невалидные данные → ValidationError

### 3.3. Integration-тесты Python

#### `test_endpoints.py` — все 12 эндпоинтов через TestClient (20+ тестов)

Мокать: `instagrapi.Client` (все методы). Тестировать: FastAPI routing, Pydantic validation, error handling, response format.

- `GET /health` → 200, `{"status": "ok"}`
- `POST /auth/login` — успех → session_data + user info
- `POST /auth/login` — ChallengeRequired → 401, error_code
- `POST /auth/login` — невалидные данные → 422
- `POST /account/info` — возвращает user_pk, username, profile_pic_url
- `POST /account/feed` — cold_start → список постов + next_max_id
- `POST /account/feed` — пагинация с max_id → следующая страница
- `POST /account/feed` — пустая лента → пустой массив
- `POST /media/like` — успех → success: true
- `POST /media/like` — rate_limited → 429
- `POST /media/comment` — успех → comment data
- `POST /user/info` — возвращает профиль пользователя
- `POST /search/hashtag` — возвращает посты + next_max_id
- `POST /search/hashtag` — пустой результат
- `POST /search/locations` — возвращает список локаций
- `POST /search/location` — возвращает посты по локации
- `POST /media/comments` — возвращает комментарии с пагинацией (min_id)
- `POST /media/comments/replies` — возвращает ответы на комментарий
- Все эндпоинты: невалидный session_data → ошибка
- Все эндпоинты: LoginRequired → 401 с error_code
- Все эндпоинты: timeout → 504 с error_code

---

## 4. Backend Laravel — план тестов

### 4.1. Factories (создать недостающие)

```
database/factories/
├── UserFactory.php                    # ✅ есть
├── InstagramAccountFactory.php        # ✅ есть
├── AccountActivityLogFactory.php      # ❌ создать
├── DeviceProfileFactory.php           # ❌ создать
├── LlmSettingFactory.php              # ❌ создать
└── LlmSystemPromptFactory.php         # ❌ создать
```

### 4.2. Unit-тесты — Repositories

#### `tests/Unit/UserRepositoryTest.php` — ✅ есть (4 теста)

#### `tests/Unit/InstagramAccountRepositoryTest.php` — ❌ создать (12 тестов)
- `getAllAccounts` — возвращает все аккаунты
- `getAccountsByUser` — только аккаунты конкретного пользователя
- `createAccount` — создаёт аккаунт с зашифрованным паролем и session_data
- `findById` — находит по ID
- `findById` — возвращает null для несуществующего ID
- `findByIdAndUser` — находит только аккаунт конкретного пользователя
- `findByIdAndUser` — возвращает null для чужого аккаунта
- `findByLogin` — находит по instagram_login
- `deleteAccount` — удаляет аккаунт
- `deactivateAccount` — устанавливает is_active = false
- `updateSessionData` — обновляет session_data (зашифрованный)
- `updateSessionData` — обновляет full_name и profile_pic_url

#### `tests/Unit/ActivityLogRepositoryTest.php` — ❌ создать (14 тестов)
- `getByAccount` — базовая пагинация (per_page)
- `getByAccount` — фильтр по action
- `getByAccount` — фильтр по status
- `getByAccount` — фильтр по httpCode (из vue_response)
- `getByAccount` — фильтр по dateFrom/dateTo
- `getByAccount` — фильтр по beforeId (загрузка старых)
- `getByAccount` — фильтр по afterId (загрузка новых)
- `getByAccount` — комбинированные фильтры
- `getAroundId` — центрированная пагинация вокруг конкретного ID
- `getAroundId` — ID в начале списка (меньше записей "до")
- `getAroundId` — несуществующий ID
- `getStatsByAccount` — подсчёт статистики по аккаунту
- `getSummary` — группировка по action + status
- `getSummary` — пустой результат

#### `tests/Unit/LlmSettingsRepositoryTest.php` — ❌ создать (9 тестов)
- `getAll` — возвращает все настройки
- `findById` — находит по ID
- `findById` — null для несуществующего
- `getDefault` — возвращает default-провайдера
- `getDefault` — null если нет default
- `upsert` — создаёт новую настройку
- `upsert` — обновляет существующую
- `setDefault` — переключает is_default (транзакция: сброс всех + установка одного)
- `delete` — удаляет настройку

#### `tests/Unit/LlmSystemPromptRepositoryTest.php` — ❌ создать (3 теста)
- `findByKey` — находит по ключу
- `updateByKey` — обновляет промпт
- `updateByKey` — создаёт если не существует (upsert)

### 4.3. Unit-тесты — Models

#### `tests/Unit/Models/InstagramAccountTest.php` — ❌ создать (6 тестов)
- Шифрование `instagram_password` — setter шифрует, getter расшифровывает
- Шифрование `session_data` — setter шифрует, getter расшифровывает
- `casts` — json для device_settings, datetime для last_used_at
- Связь `belongsTo(DeviceProfile)`
- Связь `belongsTo(User)`
- `fillable` содержит все нужные поля

#### `tests/Unit/Models/AccountActivityLogTest.php` — ❌ создать (4 теста)
- `casts` — json для vue_request/response, python_request/response, instagram_request/response
- Связь `belongsTo(InstagramAccount)`
- `fillable` содержит все нужные поля
- Данные создаются через Factory

#### `tests/Unit/Models/LlmSettingTest.php` — ❌ создать (4 теста)
- Шифрование `api_key`
- `casts` — boolean для use_caption, is_default
- `hidden` — api_key скрыт из JSON
- `fillable` содержит все нужные поля

#### `tests/Unit/Models/UserTest.php` — ❌ создать (3 теста)
- HasRoles trait (Spatie) — hasRole, assignRole
- Factory `inactive()` — is_active = false
- `hidden` — password, remember_token

### 4.4. Unit-тесты — Services (с моками)

#### `tests/Unit/Services/InstagramClientServiceTest.php` — ❌ создать (25+ тестов)

**Мокать:** `Http::post()` (к Python), `ActivityLoggerServiceInterface`

- `login` — отправляет login/password/device_profile в Python, возвращает session_data
- `login` — при ошибке Python → пробрасывает exception, логирует fail
- `login` — при challenge_required → деактивирует аккаунт
- `getUserInfo` — отправляет session_data в Python /account/info
- `getUserInfo` — при login_required → деактивирует аккаунт
- `getUserInfoByPk` — отправляет user_pk в Python /user/info
- `addLike` — отправляет media_id в Python /media/like
- `addLike` — логирует успех/ошибку через ActivityLogger
- `getFeed` — cold_start без max_id
- `getFeed` — пагинация с max_id и seen_posts
- `getFeed` — возвращает items + next_max_id
- `searchHashtag` — отправляет hashtag, amount, next_max_id
- `searchHashtag` — возвращает items + next_max_id (пагинация)
- `searchLocations` — отправляет query в Python /search/locations
- `searchLocationMedias` — отправляет location_pk + пагинация
- `commentMedia` — отправляет media_id + text
- `fetchMediaComments` — отправляет media_id + min_id для пагинации
- `fetchCommentReplies` — отправляет comment_pk + min_id
- Все методы: логируют запрос/ответ через ActivityLogger
- Все методы: при ошибке логируют fail + error_message
- Таймауты: login=60s, остальные=10-30s (проверить через Http::fake)
- Деактивация при статусах: challenge_required, login_required, checkpoint_required
- Не деактивирует при rate_limited, timeout, generic error

#### `tests/Unit/Services/ActivityLoggerServiceTest.php` — ❌ создать (8 тестов)
- `log` — создаёт запись в БД
- `log` — вызывает broadcast(ActivityLogCreated)
- `logBatch` — создаёт несколько записей
- `sanitize` — скрывает session_data (заменяет на `[REDACTED]`)
- `sanitize` — скрывает password
- `sanitize` — скрывает cookies
- `sanitize` — обрабатывает вложенные объекты
- `sanitize` — не трогает безопасные данные

#### `tests/Unit/Services/LlmServiceTest.php` — ❌ создать (15 тестов)

**Мокать:** `Http::get()` (скачивание изображений), `Http::post()` (LLM API), `LlmSettingsRepository`, `LlmSystemPromptRepository`

- `generateComment` — скачивает изображение, кодирует в base64
- `generateComment` — собирает system prompt из base + additional + tone
- `generateComment` — отправляет запрос в OpenAI API (формат messages)
- `generateComment` — отправляет запрос в GLM API (формат messages)
- `generateComment` — возвращает сгенерированный текст
- `generateComment` — при ошибке скачивания → throw
- `generateComment` — при ошибке LLM API → throw
- `generateComment` — use_caption=true → включает caption в prompt
- `generateComment` — use_caption=false → не включает caption
- `generateComment` — tone=friendly → добавляет инструкцию тона
- `generateComment` — tone=null → без инструкции тона
- `testConnection` — OpenAI → успешное подключение
- `testConnection` — GLM → успешное подключение
- `testConnection` — невалидный API key → ошибка
- `testConnection` — неизвестный provider → ошибка

### 4.5. Unit-тесты — Jobs

#### `tests/Unit/Jobs/GenerateCommentJobTest.php` — ❌ создать (7 тестов)

**Мокать:** `LlmServiceInterface`, `ActivityLoggerServiceInterface`, broadcast

- `handle` — вызывает broadcast(CommentGenerationProgress) на этапах: starting, downloading, analyzing
- `handle` — при успехе → broadcast completed с текстом
- `handle` — при ошибке → broadcast failed с error_message
- `handle` — логирует в ActivityLog через ActivityLogger
- `handle` — использует default LLM settings если не указан provider_id
- `handle` — использует конкретный provider если указан provider_id
- Queue config: queue name, retry policy

### 4.6. Unit-тесты — Events

#### `tests/Unit/Events/ActivityLogCreatedTest.php` — ❌ создать (3 теста)
- `broadcastOn` — возвращает PrivateChannel('activity-log')
- `broadcastWith` — содержит данные лога
- `broadcastAs` — правильное имя события

#### `tests/Unit/Events/CommentGenerationProgressTest.php` — ❌ создать (3 теста)
- `broadcastOn` — возвращает PrivateChannel('comment-generation.{jobId}')
- `broadcastWith` — содержит step, data, error
- `broadcastAs` — правильное имя события

### 4.7. Unit-тесты — Middleware

#### `tests/Unit/Middleware/EnsureUserIsActiveTest.php` — ❌ создать (4 теста)
- Активный пользователь → пропускает запрос
- Неактивный пользователь → 403
- Неаутентифицированный → пропускает (middleware не для auth)
- Ответ содержит корректный JSON с error

### 4.8. Unit-тесты — Console Commands

#### `tests/Unit/Console/PruneActivityLogsTest.php` — ❌ создать (4 теста)
- Удаляет логи старше N дней
- Не удаляет свежие логи
- Опция --days меняет порог
- Выводит количество удалённых записей

### 4.9. Feature-тесты — Controllers (HTTP stack)

#### `tests/Feature/Auth/AuthTest.php` — ✅ есть, дополнить (3 теста)
- Регистрация с дубликатом email → 422
- Логин с невалидным email-форматом → 422
- /me без токена → 401

#### `tests/Feature/Feed/FeedTest.php` — ❌ создать (8 тестов)

**Мокать:** `InstagramClientServiceInterface`

- `GET /api/feed/{accountId}` — возвращает ленту постов
- `GET /api/feed/{accountId}?max_id=...` — пагинация
- `GET /api/feed/{accountId}` — несуществующий аккаунт → 404
- `GET /api/feed/{accountId}` — чужой аккаунт → 403
- `POST /api/feed/{accountId}/like` — лайк поста
- `POST /api/feed/{accountId}/like` — повторный лайк
- Без токена → 401
- Неактивный пользователь → 403

#### `tests/Feature/Search/SearchTest.php` — ❌ создать (10 тестов)

**Мокать:** `InstagramClientServiceInterface`

- `POST /api/search/{accountId}/hashtag` — поиск по хэштегу
- `POST /api/search/{accountId}/hashtag` — пагинация
- `POST /api/search/{accountId}/hashtag` — пустой запрос → 422
- `GET /api/search/{accountId}/locations` — поиск локаций
- `POST /api/search/{accountId}/location` — посты по локации
- `POST /api/search/{accountId}/location` — пагинация
- Несуществующий аккаунт → 404
- Чужой аккаунт → 403
- Без токена → 401
- Неактивный пользователь → 403

#### `tests/Feature/Comment/CommentTest.php` — ❌ создать (10 тестов)

**Мокать:** `InstagramClientServiceInterface`

- `GET /api/media/comments/{accountId}/{mediaId}` — корневые комментарии
- `GET /api/media/comments/{accountId}/{mediaId}?min_id=...` — пагинация
- `GET /api/media/comments/{accountId}/{mediaId}/replies/{commentPk}` — ответы
- `POST /api/media/comments/{accountId}/{mediaId}` — отправка комментария
- `POST /api/media/comments/{accountId}/{mediaId}` — пустой текст → 422
- Несуществующий аккаунт → 404
- Чужой аккаунт → 403
- Без токена → 401
- Неактивный пользователь → 403
- Rate limited от Instagram → 429

#### `tests/Feature/CommentGenerate/CommentGenerateTest.php` — ❌ создать (6 тестов)
- `POST /api/comments/generate` — dispatch job, возвращает jobId
- Без обязательных полей → 422
- Несуществующий аккаунт → 404
- Чужой аккаунт → 403
- Без токена → 401
- Job dispatched на правильную очередь

#### `tests/Feature/ActivityLog/ActivityLogTest.php` — ❌ создать (12 тестов)
- `GET /api/activity/{accountId}` — список логов
- `GET /api/activity/{accountId}?action=like` — фильтр по action
- `GET /api/activity/{accountId}?status=success` — фильтр по status
- `GET /api/activity/{accountId}?date_from=...&date_to=...` — фильтр по дате
- `GET /api/activity/{accountId}?before_id=...` — пагинация назад
- `GET /api/activity/{accountId}?after_id=...` — пагинация вперёд
- `GET /api/activity/{accountId}/stats` — статистика
- `GET /api/activity/summary` — сводка (все аккаунты)
- Чужой аккаунт → 403
- Без токена → 401
- Неактивный пользователь → 403
- Пустой результат → пустой массив, не ошибка

#### `tests/Feature/LlmSettings/LlmSettingsTest.php` — ❌ создать (14 тестов)
- `GET /api/llm-settings` — список настроек (admin only)
- `GET /api/llm-settings/{id}` — одна настройка
- `POST /api/llm-settings` — создание
- `POST /api/llm-settings` — обновление существующей
- `POST /api/llm-settings` — невалидные данные → 422
- `POST /api/llm-settings/{id}/test-connection` — тест подключения
- `POST /api/llm-settings/{id}/set-default` — установка по умолчанию
- `DELETE /api/llm-settings/{id}` — удаление
- `GET /api/llm-settings/base-prompt` — получение base prompt
- `PUT /api/llm-settings/base-prompt` — обновление base prompt
- `POST /api/llm-settings/base-prompt/reset` — сброс к умолчанию
- Не-admin → 403
- Без токена → 401
- Неактивный пользователь → 403

#### `tests/Feature/InstagramUser/InstagramUserTest.php` — ❌ создать (5 тестов)

**Мокать:** `InstagramClientServiceInterface`

- `GET /api/instagram-user/{accountId}/{userPk}` — профиль пользователя
- Несуществующий аккаунт → 404
- Чужой аккаунт → 403
- Без токена → 401
- Ошибка Instagram → 500 с error

#### `tests/Feature/ProxyImage/ProxyImageTest.php` — ❌ создать (6 тестов)

**Мокать:** `Http::get()` (скачивание с CDN), `Cache`

- `GET /api/proxy/image?url=...` — проксирует изображение с CDN
- Кэшированное изображение → возвращает из кеша (Cache::get)
- Недопустимый домен → 403
- Некорректный URL → 400
- CDN недоступен → 502
- Правильные Content-Type headers

### 4.10. Сводка по Backend

| Тип | Группа | Тестов (прим.) |
|-----|--------|---------------|
| Unit | Repositories (4 файла) | ~38 |
| Unit | Models (4 файла) | ~17 |
| Unit | Services (3 файла) | ~48 |
| Unit | Jobs (1 файл) | ~7 |
| Unit | Events (2 файла) | ~6 |
| Unit | Middleware (1 файл) | ~4 |
| Unit | Console (1 файл) | ~4 |
| Feature | Controllers (8 файлов) | ~74 |
| | **Итого новых** | **~198** |
| | Существующих | 32 |
| | **Всего** | **~230** |

---

## 5. Frontend Vue — план тестов

### 5.1. Unit-тесты — Stores

#### `entities/instagram-account/model/__tests__/accountStore.spec.ts` — ❌ создать (10 тестов)
- `fetchAccounts` — загружает аккаунты, записывает в ref
- `fetchAccounts` — при ошибке → error
- `addAccount` — отправляет данные на API, добавляет в список
- `fetchAccountDetails` — загружает детали одного аккаунта
- `fetchDeviceProfiles` — загружает профили устройств
- `deleteAccount` — удаляет аккаунт из списка
- `loginAccount` — вызывает API login, обновляет session
- `fetchAccountsLoading` — отражает состояние загрузки
- `addAccountLoading` — отражает состояние загрузки
- `deleteAccountLoading` — отражает состояние загрузки

#### `entities/media-post/model/__tests__/feedStore.spec.ts` — ❌ создать (12 тестов)
- `loadFeed` — загружает ленту, записывает в ref
- `loadFeed` — сбрасывает предыдущие данные
- `loadMoreFeed` — пагинация, дозагрузка
- `loadMoreFeed` — не дозагружает если нет nextMaxId
- `likePost` — оптимистичный update (увеличивает like_count, ставит has_liked)
- `likePost` — при ошибке → откат оптимистичного update
- `fetchUserInfo` — загружает профиль пользователя
- `refreshFeed` — перезагрузка ленты с нуля
- `cancelFeed` — отменяет текущий запрос
- `feedLoading` — computed отражает loading
- `likeLoading` — computed отражает loading
- Взаимодействие с feedCache

#### `entities/media-post/model/__tests__/searchStore.spec.ts` — ❌ создать (10 тестов)
- `searchHashtag` — поиск, записывает результаты
- `loadMoreHashtag` — пагинация хэштегов
- `fetchLocations` — поиск локаций
- `fetchLocationMedias` — посты по локации
- `loadMoreLocationMedias` — пагинация постов по локации
- `sendComment` — отправка комментария
- `searchLoading` — состояние загрузки
- Сброс данных при новом поиске
- `cancelSearch` — отмена запроса
- Обработка ошибок

#### `entities/activity-log/model/__tests__/activityLogStore.spec.ts` — ❌ создать (12 тестов)
- `fetchLogs` — загрузка логов с фильтрами
- `fetchLogs` — применяет все фильтры (action, status, date)
- `loadOlderLogs` — пагинация назад (beforeId)
- `loadOlderLogs` — не загружает если hasOlderLogs=false
- `loadAroundId` — центрированная загрузка вокруг ID
- `appendNewLog` — добавление нового лога в начало
- `resetLogs` — сброс состояния
- `fetchStats` — загрузка статистики
- `fetchSummary` — загрузка сводки
- `logsLoading` — computed
- `statsLoading` — computed
- `summaryLoading` — computed

#### `entities/activity-log/model/__tests__/sidebarActivityStore.spec.ts` — ❌ создать (8 тестов)
- `fetchLatest` — загрузка последних записей
- `selectEntry` — выбор записи для отображения
- `filteredEntries` — фильтрация по аккаунту
- localStorage — сохранение и восстановление ширины сайдбара
- localStorage — сохранение открытого/закрытого состояния
- `isOpen` — toggle open/close
- `sidebarWidth` — изменение ширины
- Обработка ошибок загрузки

#### `entities/media-post/model/__tests__/commentStore.spec.ts` — ❌ создать (7 тестов)
- `fetchComments` — загрузка комментариев
- `loadMoreComments` — пагинация
- `loadMoreComments` — не загружает если нет nextMinId
- `fetchReplies` — загрузка ответов на комментарий
- `commentsLoading` — computed
- `repliesLoading` — computed
- Сброс комментариев при смене поста

#### `entities/llm-settings/model/__tests__/llmSettingsStore.spec.ts` — ❌ создать (10 тестов)
- `fetchAll` — загрузка всех настроек
- `saveSetting` — создание новой настройки
- `saveSetting` — обновление существующей
- `setDefault` — установка по умолчанию
- `deleteSetting` — удаление
- `testConnection` — тест подключения
- `fetchBasePrompt` — загрузка base prompt
- `updateBasePrompt` — обновление base prompt
- `resetBasePrompt` — сброс к умолчанию
- Loading/error computed свойства

### 5.2. Unit-тесты — DTOs

#### `entities/instagram-account/model/__tests__/instagramAccountDTO.spec.ts` — ❌ создать (6 тестов)
- `toLocal` — маппинг одного аккаунта (snake_case → camelCase)
- `toLocalList` — маппинг массива
- `toLocalDetailed` — маппинг с расширенными полями
- `toLocalDeviceProfiles` — маппинг профилей устройств
- `toApiRequest` — маппинг обратно (camelCase → snake_case)
- Обработка null/undefined полей

#### `entities/media-post/model/__tests__/mediaPostDTO.spec.ts` — ❌ создать (10 тестов)
- `toLocalPost` — маппинг поста с user, resources, location
- `toLocalPost` — обработка media_type (photo/video/carousel)
- `toLocalUser` — маппинг пользователя
- `toLocalResource` — маппинг ресурсов карусели
- `toLocalComments` — маппинг комментариев
- `toLocalCommentReplies` — маппинг ответов
- `toLocalFeedResponse` — маппинг полного ответа ленты с nextMaxId
- `toLocalSearchResponse` — маппинг ответа поиска
- Обработка null/пустых полей
- Проксирование URL изображений (proxyImageUrl)

#### `entities/activity-log/model/__tests__/activityLogDTO.spec.ts` — ❌ создать (5 тестов)
- `toLocal` — маппинг одного лога
- `toLocalLogsResponse` — маппинг с метаданными пагинации
- `toLocalStats` — маппинг статистики
- `toLocalSummaryList` — маппинг сводки
- Обработка null в json-полях (vue_request, python_response и т.д.)

#### `entities/llm-settings/model/__tests__/llmSettingsDTO.spec.ts` — ❌ создать (3 теста)
- `toLocal` — маппинг настройки
- `toLocalList` — маппинг массива
- `toApi` — маппинг для отправки на сервер

### 5.3. Unit-тесты — Composables / Hooks

#### `shared/lib/__tests__/useModal.spec.ts` — ❌ создать (4 теста)
- `isVisible` — начальное состояние false
- `open()` — ставит isVisible = true
- `close()` — ставит isVisible = false
- `open(data)` — сохраняет payload

#### `shared/lib/__tests__/useFilterColumns.spec.ts` — ❌ создать (3 теста)
- Возвращает columns и columnsVisibleNames
- columnsVisibleNames — массив name из columns
- Реактивность при изменении фильтра

#### `shared/lib/__tests__/useSearchQuery.spec.ts` — ❌ создать (2 теста)
- searchText — начальное значение ''
- searchText — реактивен

#### `shared/lib/__tests__/useReverseInfiniteScroll.spec.ts` — ❌ создать (5 тестов)
- Вызывает loadOlderFn при scrollY < threshold
- Не вызывает если уже loading
- Восстанавливает позицию скролла после подгрузки
- Не восстанавливает если addedHeight = 0
- Очищает listener при destroy

#### `shared/lib/__tests__/useForwardProps.spec.ts` — ❌ создать (4 теста)
- Фильтрует undefined из пропсов
- Пробрасывает defined пропсы
- Реактивен при изменении пропсов
- Корректно работает с boolean false (не фильтрует)

#### `shared/lib/__tests__/formatters.spec.ts` — ❌ создать (8 тестов)
- `formatCount` — форматирование числа (1000 → 1K, 1000000 → 1M)
- `formatDate` — форматирование даты
- `formatTime` — форматирование времени
- `formatDuration` — форматирование длительности (мс → "1.2s")
- `formatRelativeTime` — относительное время ("5 минут назад")
- `formatDateRu` — дата на русском
- Edge cases: null, undefined, 0
- Локаль: русский язык

#### `shared/lib/__tests__/validators.spec.ts` — ❌ создать (4 теста)
- `requiredField` — пустая строка → ошибка, непустая → true
- `checkEmail` — валидный email → true
- `checkEmail` — невалидный email → ошибка
- Совместимость с Quasar rules формат

#### `shared/lib/__tests__/notify.spec.ts` — ❌ создать (3 теста)
- `notifySuccess` — вызывает Notify.create с type='positive'
- `notifyError` — вызывает Notify.create с type='negative'
- Сообщение передаётся корректно

#### `shared/lib/__tests__/proxyImageUrl.spec.ts` — ❌ создать (3 теста)
- Преобразует Instagram CDN URL в proxy URL
- Обработка null → null
- Корректное URL-кодирование

#### `features/generate-comment/model/__tests__/useCommentGeneration.spec.ts` — ❌ создать (8 тестов)

**Мокать:** echo (Laravel Echo)

- Подписывается на канал `private:comment-generation.{jobId}`
- Получает событие downloading → обновляет step
- Получает событие analyzing → обновляет step
- Получает событие completed → обновляет step + data
- Получает событие failed → обновляет step + error
- Timeout 120s → автоматический failed
- `cleanup()` — отписывается от канала
- onBeforeUnmount → cleanup

#### `features/activity-live/model/__tests__/useActivityLive.spec.ts` — ❌ создать (5 тестов)

**Мокать:** echo (Laravel Echo)

- Подписывается на канал `private:activity-log`
- Получает событие → вызывает callback
- Watch accountId → переподписывается на новый канал
- onBeforeUnmount → отписывается
- Не подписывается если accountId = null

#### `shared/lib/__tests__/useFeedCache.spec.ts` — ❌ создать (6 тестов)
- Сохраняет посты в localStorage
- Восстанавливает посты из localStorage
- Ограничивает MAX_SEEN_POSTS
- Очищает кэш при `clear()`
- Обрабатывает невалидный JSON в localStorage
- Обрабатывает пустой localStorage

#### `shared/lib/__tests__/useAccountSelect.spec.ts` — ❌ создать (4 теста)
- Сохраняет выбранный аккаунт в localStorage
- Восстанавливает из localStorage
- Сбрасывает если аккаунт удалён из списка
- Реактивно обновляется при смене аккаунта

### 5.4. Unit-тесты — UI Components (выборочно)

Для wrapper-компонентов тестировать только проброс пропсов и слотов — внутренняя логика Quasar не тестируется.

#### `shared/ui/table-component/__tests__/TableComponent.spec.ts` — ❌ создать (4 теста)
- Пробрасывает columns и rows в QTable
- Пробрасывает слоты (body-cell, header-cell)
- forwarded props не содержат undefined
- v-model работает (selection)

#### `shared/ui/modal-component/__tests__/ModalComponent.spec.ts` — ❌ создать (3 теста)
- v-model управляет видимостью
- Пробрасывает слоты
- Пробрасывает пропсы в QDialog

#### `shared/ui/media-card/__tests__/MediaCard.spec.ts` — ❌ создать (4 теста)
- Рендерит thumbnail
- Показывает overlay с like_count / comment_count
- Emit click
- Обрабатывает разные media_type (фото/видео)

### 5.5. Unit-тесты — Widget утилиты

#### `widgets/activity-log-table/model/__tests__/responseFormatters.spec.ts` — ❌ создать (6 тестов)
- `extractKey` — извлекает ключ из объекта
- `compactify` — сжимает данные для компактного отображения
- `hasNestedData` — определяет наличие вложенных объектов/массивов
- `previewTooltip` — генерирует tooltip для preview-полей
- `display` — форматирует значение для отображения
- Edge cases: null, undefined, пустой объект, пустой массив

### 5.6. Unit-тесты — Router

#### `router/__tests__/routes.spec.ts` — ❌ создать (6 тестов)
- Guard: неаутентифицированный → redirect на /login
- Guard: аутентифицированный + requiresGuest → redirect на /
- Guard: не-admin + requiresAdmin → redirect на /
- Guard: admin + requiresAdmin → пропускает
- Все маршруты имеют корректные meta
- 404 → ErrorNotFound page

### 5.7. Unit-тесты — Boot / Axios

#### `boot/__tests__/axios.spec.ts` — ❌ создать (4 теста)
- Interceptor: добавляет Authorization header с токеном
- Interceptor: 401 → очищает токен, redirect на /login
- Interceptor: не редиректит если уже на /login
- Base URL из import.meta.env

### 5.8. Сводка по Frontend Unit

| Группа | Файлов | Тестов (прим.) |
|--------|--------|---------------|
| Stores (7 файлов) | 7 | ~69 |
| DTOs (4 файла) | 4 | ~24 |
| Composables (14 файлов) | 14 | ~59 |
| UI Components (3 файла) | 3 | ~11 |
| Widget утилиты (1 файл) | 1 | ~6 |
| Router (1 файл) | 1 | ~6 |
| Boot (1 файл) | 1 | ~4 |
| **Итого новых** | **31** | **~179** |
| Существующих | 6 | 34 |
| **Всего** | **37** | **~213** |

---

## 6. E2E тесты (Playwright)

### Существующие
- `e2e/auth.spec.ts` — логин, logout, redirect неавторизованного
- `e2e/admin-users.spec.ts` — список пользователей, toggle active

### Новые сценарии

#### `e2e/instagram-accounts.spec.ts` — ❌ создать (6 тестов)
- Отображение списка аккаунтов (таблица)
- Добавление аккаунта (модальное окно, форма)
- Просмотр деталей аккаунта (модальное окно)
- Удаление аккаунта (подтверждение)
- Поиск в таблице
- Фильтрация колонок

#### `e2e/feed.spec.ts` — ❌ создать (5 тестов)
- Загрузка ленты (masonry grid)
- Клик на пост → открытие PostDetailModal
- Лайк поста (обновление счётчика)
- Бесконечная прокрутка (загрузка следующей страницы)
- Переключение аккаунта → перезагрузка ленты

#### `e2e/search.spec.ts` — ❌ создать (5 тестов)
- Поиск по хэштегу → отображение результатов
- Поиск локации → отображение списка
- Выбор локации → отображение постов
- Пагинация результатов
- Отправка комментария из поиска

#### `e2e/llm-settings.spec.ts` — ❌ создать (4 теста)
- Только admin видит страницу
- Создание/редактирование LLM настройки
- Установка по умолчанию
- Редактирование base prompt

#### `e2e/activity-logs.spec.ts` — ❌ создать (5 тестов)
- Отображение таблицы логов
- Фильтрация по действию/статусу/дате
- Разворот строки → детали лога
- Боковая панель с записями
- Статистика и сводка

#### `e2e/navigation.spec.ts` — ❌ создать (3 теста)
- Навигация между страницами через меню
- Breadcrumbs / page titles
- 404 страница для несуществующих маршрутов

### E2E сводка

| Файл | Тестов |
|------|--------|
| instagram-accounts.spec.ts | ~6 |
| feed.spec.ts | ~5 |
| search.spec.ts | ~5 |
| llm-settings.spec.ts | ~4 |
| activity-logs.spec.ts | ~5 |
| navigation.spec.ts | ~3 |
| **Итого новых** | **~28** |
| Существующих | 6 |
| **Всего** | **~34** |

---

## 7. Интеграционные тесты (cross-service)

Тестируют реальное взаимодействие между сервисами через Docker.

### 7.1. Laravel ↔ Python (через HTTP)

Файл: `backend-laravel/tests/Integration/InstagramClientServiceIntegrationTest.php`

**Требования:** Docker-контейнеры запущены, тестовый аккаунт Instagram доступен.

**Подготовка данных через DEBUG_PROTOCOL.md:**
1. Извлечь session.json через Tinker (шаг 1 протокола)
2. Сохранить fixtures в `_TEST/fixtures/`

**Тесты (8):**
- Login → Python → Instagram → session_data обновлён
- getFeed → Python → Instagram → посты возвращены
- searchHashtag → Python → Instagram → результаты
- addLike → Python → Instagram → success
- fetchMediaComments → Python → Instagram → комментарии
- Ошибка Python (500) → Laravel корректно обрабатывает
- Таймаут Python → Laravel корректно обрабатывает
- ActivityLog записан для каждого запроса

### 7.2. Vue ↔ Laravel (через HTTP)

Файл: `frontend-vue/tests/integration/api.spec.ts`

**Требования:** Docker-контейнеры запущены.

**Тесты (6):**
- Login через API → получение токена
- Запрос с токеном → авторизован
- Запрос без токена → 401
- Запрос неактивного пользователя → 403
- CORS headers корректны
- WebSocket авторизация (broadcasting/auth)

### 7.3. Полная цепочка Vue ↔ Laravel ↔ Python

Файл: `_TEST/integration/full-chain.spec.ts` (или bash-скрипт)

**Следует DEBUG_PROTOCOL.md:**
1. Извлечь session.json
2. Raw запрос в Python → сохранить `01_python_*.json`
3. Вызов через Laravel (Tinker) → сохранить `02_laravel_*.json`
4. HTTP запрос в Laravel (cURL + Bearer) → сохранить `03_laravel_http_*.json`
5. Сравнить структуру и данные между слоями

**Тесты (4):**
- feed: Python raw ↔ Laravel service ↔ Laravel HTTP — одинаковая структура
- search: Python raw ↔ Laravel service ↔ Laravel HTTP
- comments: Python raw ↔ Laravel service ↔ Laravel HTTP
- Ошибки: Python error → Laravel error → Vue error — корректная цепочка

---

## 8. Порядок выполнения

### Phase 1 — Инфраструктура (1-2 дня)

1. **Python**: Создать `tests/`, `conftest.py`, `pytest.ini`, `requirements-dev.txt`
2. **Laravel**: Создать недостающие Factories (4 шт.)
3. **Vue**: Проверить vitest.config.ts, добавить test:coverage в CI
4. **Fixtures**: Через DEBUG_PROTOCOL извлечь и сохранить тестовые данные

### Phase 2 — Python Unit + Integration (2-3 дня)

5. `test_schemas.py` — самое простое, разогрев
6. `test_utils.py` — маппинг ошибок
7. `test_lock.py` — asyncio locks
8. `test_client.py` — кеш клиентов
9. `test_helpers.py` — сериализация (самый объёмный)
10. `test_endpoints.py` — integration тесты эндпоинтов

### Phase 3 — Laravel Unit (3-4 дня)

11. Models — шифрование, casts, связи
12. Repositories — CRUD, фильтрация, пагинация
13. ActivityLoggerService — логирование, sanitize
14. InstagramClientService — HTTP, деактивация, логирование (самый объёмный)
15. LlmService — генерация, тест подключения
16. GenerateCommentJob — очередь, broadcast
17. Events — каналы, данные
18. Middleware — active check
19. Console — prune logs

### Phase 4 — Laravel Feature (2-3 дня)

20. Feed, Search, Comment контроллеры
21. CommentGenerate, ActivityLog контроллеры
22. LlmSettings контроллер
23. InstagramUser, ProxyImage контроллеры
24. Дополнить Auth, InstagramAccount, Admin тесты

### Phase 5 — Vue Unit: Stores + DTOs (2-3 дня)

25. accountStore, feedStore, searchStore
26. activityLogStore, sidebarActivityStore
27. commentStore, llmSettingsStore
28. Все DTOs (mediaPostDTO — самый сложный)

### Phase 6 — Vue Unit: Composables + Utils (2-3 дня)

29. formatters, validators, notify, proxyImageUrl
30. useModal, useFilterColumns, useSearchQuery
31. useReverseInfiniteScroll, useForwardProps
32. useCommentGeneration, useActivityLive
33. useFeedCache, useAccountSelect
34. responseFormatters

### Phase 7 — Vue Unit: Components + Router (1-2 дня)

35. TableComponent, ModalComponent, MediaCard
36. Router guards
37. Axios boot (interceptors)

### Phase 8 — E2E (2-3 дня)

38. instagram-accounts.spec.ts
39. feed.spec.ts
40. search.spec.ts
41. llm-settings.spec.ts
42. activity-logs.spec.ts
43. navigation.spec.ts

### Phase 9 — Integration cross-service (1-2 дня)

44. Laravel ↔ Python integration
45. Vue ↔ Laravel integration
46. Полная цепочка (DEBUG_PROTOCOL)

---

## 9. Запуск тестов

### Python
```bash
# Установить dev-зависимости
docker compose exec python pip install -r requirements-dev.txt

# Все тесты
docker compose exec python pytest

# С покрытием
docker compose exec python pytest --cov=. --cov-report=html

# Конкретный файл
docker compose exec python pytest tests/unit/test_helpers.py -v
```

### Laravel
```bash
# Все тесты
docker compose exec laravel php artisan test

# С покрытием
docker compose exec laravel php artisan test --coverage

# Конкретная группа
docker compose exec laravel php artisan test --filter=InstagramClientServiceTest

# Unit-тесты
docker compose exec laravel php artisan test tests/Unit

# Feature-тесты
docker compose exec laravel php artisan test tests/Feature
```

### Vue Unit
```bash
# Все тесты
docker compose exec vue npm run test:unit

# С покрытием
docker compose exec vue npm run test:unit:coverage

# Watch-режим
docker compose exec vue npm run test:unit:watch

# Конкретный файл
docker compose exec vue npx vitest run src/entities/media-post/model/__tests__/feedStore.spec.ts
```

### Vue E2E (Playwright)
```bash
# Все Docker-сервисы должны быть запущены
docker compose up -d

# Установить браузеры (первый раз)
cd frontend-vue && npx playwright install chromium

# Все e2e тесты
npm run test:e2e

# С UI
npm run test:e2e:ui

# С headed-браузером
npm run test:e2e:headed

# Конкретный файл
npx playwright test e2e/feed.spec.ts
```

### Все тесты разом
```bash
# Быстрая проверка (unit only)
docker compose exec python pytest && \
docker compose exec laravel php artisan test && \
docker compose exec vue npm run test:unit

# Полная проверка (unit + e2e)
docker compose exec python pytest && \
docker compose exec laravel php artisan test && \
docker compose exec vue npm run test:unit && \
cd frontend-vue && npm run test:e2e
```

---

## 10. Fixtures и тестовые данные

### Получение реальных данных (DEBUG_PROTOCOL)

Для интеграционных тестов и создания fixtures — использовать `DEBUG_PROTOCOL.md`:

```bash
# 1. Извлечь session.json
docker compose exec -T laravel php artisan tinker <<'TINKER'
$id = 3;
$a = \App\Models\InstagramAccount::find($id);
file_put_contents(base_path("session_{$id}.json"), json_encode(json_decode($a->session_data, true), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "OK";
TINKER
cp backend-laravel/session_3.json _TEST/session.json

# 2. Получить fixture ленты
jq -n --arg sd "$(cat _TEST/session.json)" \
  '{session_data: $sd, reason: "cold_start_fetch", min_posts: 5}' | \
curl -s -X POST http://localhost:8001/account/feed \
  -H "Content-Type: application/json" \
  -d @- | jq . > _TEST/fixtures/feed_response.json

# 3. Получить fixture комментариев
jq -n --arg sd "$(cat _TEST/session.json)" \
  '{session_data: $sd, media_id: "MEDIA_ID_HERE"}' | \
curl -s -X POST http://localhost:8001/media/comments \
  -H "Content-Type: application/json" \
  -d @- | jq . > _TEST/fixtures/comments_response.json
```

### Структура fixtures

```
_TEST/
├── session.json                    # Сессия (НЕ коммитить)
├── fixtures/
│   ├── feed_response.json          # Ответ /account/feed
│   ├── hashtag_response.json       # Ответ /search/hashtag
│   ├── location_response.json      # Ответ /search/location
│   ├── comments_response.json      # Ответ /media/comments
│   ├── user_info_response.json     # Ответ /user/info
│   └── account_info_response.json  # Ответ /account/info
├── 01_python_*.json                # Raw ответы Python
├── 02_laravel_*.json               # Laravel через Tinker
└── 03_laravel_http_*.json          # Laravel через HTTP
```

### Sanitized fixtures (для коммита)

Для unit-тестов, которые не обращаются к реальному API, создать sanitized версии fixtures без чувствительных данных:

```
python-service/tests/fixtures/        # Sanitized JSON для pytest
backend-laravel/tests/fixtures/       # Sanitized JSON для PHPUnit
frontend-vue/src/**/__tests__/        # Inline test data или __fixtures__/
```

**Что sanitize:**
- Убрать session_data, cookies, tokens
- Заменить user_pk на фейковые ID
- Заменить username на тестовые
- Оставить структуру и типы данных

---

## Общая сводка

| Слой | Unit | Feature/Integration | E2E | Итого |
|------|------|-------------------|-----|-------|
| Python | ~38 | ~20 | — | ~58 |
| Laravel | ~124 | ~74 | — | ~198 |
| Vue | ~179 | ~6 | ~28 | ~213 |
| Cross-service | — | ~12 | — | ~12 |
| **Итого новых** | **~341** | **~112** | **~28** | **~481** |
| Существующих | 36 | 28 | 6 | 72 |
| **Всего** | **~377** | **~140** | **~34** | **~553** |

**Оценка по Phases (8 фаз):**

| Phase | Описание | Новых тестов |
|-------|----------|-------------|
| 1 | Инфраструктура | — |
| 2 | Python Unit + Integration | ~58 |
| 3 | Laravel Unit | ~124 |
| 4 | Laravel Feature | ~74 |
| 5 | Vue Stores + DTOs | ~93 |
| 6 | Vue Composables + Utils | ~59 |
| 7 | Vue Components + Router | ~21 |
| 8 | E2E (Playwright) | ~28 |
| 9 | Integration cross-service | ~18 |
