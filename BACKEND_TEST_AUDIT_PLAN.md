# План аудита бэкенд-тестов (Laravel) — insta-pilot

## Обзор текущего состояния

| Уровень | Фреймворк | Кол-во файлов | Расположение |
|---------|-----------|---------------|-------------|
| Unit | PHPUnit 11.5 + Mockery | 17 | `tests/Unit/` |
| Feature | PHPUnit (HTTP tests) | 10 | `tests/Feature/` |
| Integration | PHPUnit + Docker (Python) | 1 | `tests/Integration/` |
| Factories | Faker + Factory states | 6 | `database/factories/` |
| **Итого тестов** | | **28** | |

**Конфигурация:** SQLite in-memory, queue=sync, cache=array, broadcast=null, salt=`test_salt_for_testing`

---

## Раздел 1. Аудит unit-тестов (17 файлов)

### 1.1 Model-тесты (4 файла)

| # | Файл | Строк | Что тестирует |
|---|------|-------|---------------|
| 1 | `Unit/Models/UserTest.php` | 35 | Spatie roles, hidden-атрибуты, factory state |
| 2 | `Unit/Models/InstagramAccountTest.php` | 65 | Шифрование password/session_data, отношения, fillable |
| 3 | `Unit/Models/AccountActivityLogTest.php` | 47 | JSON-касты, отключённые timestamps, отношения |
| 4 | `Unit/Models/LlmSettingTest.php` | 48 | Шифрование api_key, булевые касты, hidden |

**Чек-лист для каждого model-теста:**
- [ ] Все Accessor'ы (шифрование) проверены: set → get возвращает исходное значение
- [ ] Nullable-поля: `null` на входе остаётся `null` (не шифруется)
- [ ] `$fillable` содержит все необходимые поля (сравнить с миграцией)
- [ ] `$hidden` скрывает чувствительные данные в `toArray()` / `toJson()`
- [ ] `$casts` корректно приводят типы (boolean, json, datetime)
- [ ] Отношения (`belongsTo`, `hasMany`) возвращают правильные модели
- [ ] Нет тестов на бизнес-логику в модели (она должна быть в Service/Repository)

---

### 1.2 Repository-тесты (5 файлов)

| # | Файл | Строк | Что тестирует |
|---|------|-------|---------------|
| 1 | `Unit/InstagramAccountRepositoryTest.php` | 131 | CRUD, поиск по user_id/login, деактивация, session update |
| 2 | `Unit/ActivityLogRepositoryTest.php` | 193 | Пагинация, фильтры, stats (success_rate, avg duration) |
| 3 | `Unit/LlmSettingsRepositoryTest.php` | 102 | CRUD, upsert, set default |
| 4 | `Unit/LlmSystemPromptRepositoryTest.php` | 49 | find by key, update, exception на несуществующий key |
| 5 | `Unit/UserRepositoryTest.php` | 53 | toggleActive, updateRole, find |

**Чек-лист для каждого repository-теста:**
- [ ] Каждый публичный метод интерфейса покрыт хотя бы одним тестом
- [ ] Success-кейс + edge-кейс (null, не найден, пустая коллекция)
- [ ] `assertDatabaseHas` / `assertDatabaseMissing` — данные реально сохранены/удалены
- [ ] Фильтры: тестируется что НЕ подходящие записи не возвращаются
- [ ] Пагинация: проверяется limit, offset, cursor (beforeId/afterId)
- [ ] Stats: проверяются математические вычисления (success_rate, avg)
- [ ] Нет мокирования БД — тесты работают с реальной SQLite in-memory
- [ ] `RefreshDatabase` обеспечивает изоляцию между тестами
- [ ] Фабрики используются для создания тестовых данных (не raw insert)

**Отсутствующие тесты:**
- [ ] `DeviceProfileRepository` — нет отдельного теста (если репозиторий существует)

---

### 1.3 Service-тесты (3 файла)

| # | Файл | Строк | Что тестирует |
|---|------|-------|---------------|
| 1 | `Unit/Services/LlmServiceTest.php` | 307 | Генерация комментариев, system prompt composition, провайдеры, ошибки |
| 2 | `Unit/Services/InstagramClientServiceTest.php` | 281 | Все методы Python API: login, feed, like, search, comments |
| 3 | `Unit/Services/ActivityLoggerServiceTest.php` | 158 | Логирование, broadcast, batch, sanitize sensitive data |

**Чек-лист для LlmServiceTest:**
- [ ] `generateComment`: success-кейс с полной цепочкой (download image → compose prompt → call LLM → parse response)
- [ ] System prompt: base + additional + tone — все комбинации
- [ ] `use_caption=true` включает caption в prompt, `false` — нет
- [ ] Форматы провайдеров: OpenAI (без thinking) vs GLM (thinking: disabled)
- [ ] Ошибки: нет default setting, ошибка загрузки изображения, ошибка LLM API
- [ ] `testConnection`: success, API error, unknown provider
- [ ] `Http::fake()` — проверить что URL-паттерны соответствуют реальным
- [ ] Мок `LlmSettingsRepositoryInterface` — возвращает корректные factory-данные

**Чек-лист для InstagramClientServiceTest:**
- [ ] Каждый метод: правильный HTTP verb + endpoint + payload
- [ ] `login`: credentials передаются, device_settings пробрасываются
- [ ] `getUserInfo`: деактивация аккаунта при `login_required` / `challenge_required`
- [ ] `getUserInfo`: НЕ деактивирует при `rate_limit`
- [ ] `getFeed`: cold start (без max_id) vs pagination (с max_id + seen_posts)
- [ ] Search-методы: опциональные параметры (next_max_id) пропускаются если null
- [ ] `Http::fake()` покрывает `http://python:8001/*` — корректен ли URL?
- [ ] Мокирование `ActivityLoggerServiceInterface` — вызывается ли `log()` с правильным action?
- [ ] Мокирование `InstagramAccountRepositoryInterface` — `deactivateAccount()` вызывается

**Чек-лист для ActivityLoggerServiceTest:**
- [ ] `log()` создаёт запись в `account_activity_logs`
- [ ] `log()` dispatch'ит `ActivityLogCreated` event
- [ ] `logBatch()` создаёт несколько записей за один вызов
- [ ] Sanitize: удаляет `session_data`, `password`, `cookie`, `token` из payload
- [ ] Sanitize: НЕ удаляет безопасные поля
- [ ] Sanitize: не рекурсирует в вложенные объекты (или рекурсирует?)
- [ ] Event payload содержит все обязательные поля для фронтенда

---

### 1.4 Job-тесты (1 файл)

| # | Файл | Строк | Что тестирует |
|---|------|-------|---------------|
| 1 | `Unit/Jobs/GenerateCommentJobTest.php` | 136 | Broadcast progress events, логирование, конфигурация |

**Чек-лист:**
- [ ] `handle()` success: broadcast `downloading` → `analyzing` → `completed`
- [ ] `handle()` success: `completed` содержит текст комментария
- [ ] `handle()` error: broadcast `failed` с сообщением ошибки
- [ ] Логирование: success с accountId/userId, error с accountId/userId
- [ ] Job config: `tries=1`, `timeout=90` — адекватны ли значения?
- [ ] Мокирование `LlmServiceInterface` и `ActivityLoggerServiceInterface`
- [ ] `Event::fake()` — проверяется dispatch `CommentGenerationProgress`
- [ ] Нет тестов на retry-логику (tries=1 — нет retry)
- [ ] Нет тестов на `failed()` метод (если определён)
- [ ] Queue connection / queue name — тестируются?

---

### 1.5 Event-тесты (2 файла)

| # | Файл | Строк | Что тестирует |
|---|------|-------|---------------|
| 1 | `Unit/Events/ActivityLogCreatedTest.php` | 56 | Каналы, payload, имя события |
| 2 | `Unit/Events/CommentGenerationProgressTest.php` | 35 | Канал с jobId, payload, имя |

**Чек-лист:**
- [ ] `broadcastOn()` возвращает правильные private-каналы
- [ ] `broadcastWith()` содержит все поля, которые фронтенд ожидает
- [ ] `broadcastAs()` возвращает имя, совпадающее с фронтенд-подпиской (Echo)
- [ ] Канал `ActivityLogCreated`: `private-account-activity.{accountId}` + `private-activity-log`
- [ ] Канал `CommentGenerationProgress`: `private-comment-generation.{jobId}`
- [ ] Payload сериализуется корректно (нет Eloquent-объектов, только примитивы/массивы)

---

### 1.6 Middleware-тест (1 файл)

| # | Файл | Строк | Что тестирует |
|---|------|-------|---------------|
| 1 | `Unit/Middleware/EnsureUserIsActiveTest.php` | 43 | Active → 200, inactive → 403, unauthenticated → 401 |

**Чек-лист:**
- [ ] Активный пользователь — middleware пропускает (200)
- [ ] Неактивный пользователь — 403 с `error` ключом в JSON
- [ ] Неавторизованный — 401 (от Sanctum, не от middleware)
- [ ] Middleware зарегистрирован в `bootstrap/app.php` или route middleware?
- [ ] Тест проверяет middleware изолированно или через route?

---

### 1.7 Console-тест (1 файл)

| # | Файл | Строк | Что тестирует |
|---|------|-------|---------------|
| 1 | `Unit/Console/PruneActivityLogsTest.php` | 56 | Удаление старых логов, опция --days, вывод |

**Чек-лист:**
- [ ] Удаляются записи старше 90 дней (дефолт)
- [ ] Свежие записи сохраняются
- [ ] `--days=N` меняет порог
- [ ] Вывод содержит количество удалённых записей
- [ ] Граничный случай: 0 записей для удаления
- [ ] Команда зарегистрирована в `Kernel` / `routes/console.php`?

---

## Раздел 2. Аудит feature-тестов (10 файлов)

### 2.1 API Endpoint-тесты

| # | Файл | Строк | Endpoints | Кол-во тестов |
|---|------|-------|-----------|---------------|
| 1 | `Feature/Auth/AuthTest.php` | 131 | `/api/auth/*` | 10 |
| 2 | `Feature/InstagramAccount/InstagramAccountTest.php` | 177 | `/api/accounts/*` | 9 |
| 3 | `Feature/Feed/FeedTest.php` | 124 | `/api/feed/*` | 9 |
| 4 | `Feature/Comment/CommentTest.php` | 116 | `/api/media/comments/*` | 8 |
| 5 | `Feature/Search/SearchTest.php` | 122 | `/api/search/*` | 8 |
| 6 | `Feature/CommentGenerate/CommentGenerateTest.php` | 75 | `/api/comments/generate` | 6 |
| 7 | `Feature/InstagramUser/InstagramUserTest.php` | 87 | `/api/instagram-user/*` | 5 |
| 8 | `Feature/LlmSettings/LlmSettingsTest.php` | 206 | `/api/llm-settings/*` | ~13 |
| 9 | `Feature/Admin/AdminUserTest.php` | 122 | `/api/admin/users/*` | 9 |
| 10 | `Feature/ActivityLog/ActivityLogTest.php` | 151 | `/api/accounts/*/activity` | 10 |
| 11 | `Feature/ProxyImage/ProxyImageTest.php` | 75 | `/api/proxy/image` | 6 |

### 2.2 Общий чек-лист для каждого feature-теста

**Авторизация и безопасность:**
- [ ] 401 для неавторизованного запроса
- [ ] 403 для неактивного пользователя
- [ ] 403 для non-admin (если endpoint admin-only)
- [ ] 404 для чужого ресурса (ownership check, не 403 — не раскрывает существование)
- [ ] Проверить: используется `actingAs()` + Sanctum guard

**Валидация:**
- [ ] 422 для отсутствующих required-полей
- [ ] 422 для невалидных данных (email format, URL format, enum values)
- [ ] Проверяется структура ошибок валидации

**Success-кейсы:**
- [ ] Корректный HTTP-код (200, 201, 204)
- [ ] Формат ответа: `{ success: true, data: ..., message: '...' }`
- [ ] `assertJsonStructure()` — проверяется структура data
- [ ] `assertJsonPath()` — проверяются ключевые значения

**Мокирование внешних сервисов:**
- [ ] `InstagramClientServiceInterface` замокан (не вызывается реальный Python)
- [ ] `LlmServiceInterface` замокан (не вызывается реальный LLM API)
- [ ] `Http::fake()` для proxy/CDN запросов
- [ ] `Queue::fake()` для job-диспатчинга
- [ ] `Event::fake()` где нужно (или наоборот — не fake, если тестируется event)

**Изоляция данных:**
- [ ] Тесты не зависят от seed-данных (используют фабрики)
- [ ] `RefreshDatabase` очищает всё между тестами
- [ ] Нет shared state через статические свойства

---

### 2.3 Детальный аудит по каждому feature-тесту

#### AuthTest.php (10 тестов)
- [ ] Register: создаёт пользователя + возвращает Sanctum-токен
- [ ] Register: email уникальность, required-поля
- [ ] Login: success + токен в ответе
- [ ] Login: wrong password → 401 (не 422)
- [ ] Login: невалидный email → 422
- [ ] Inactive user → 403 на protected route
- [ ] Logout: удаляет текущий токен
- [ ] Me: возвращает данные авторизованного пользователя
- [ ] Me: unauthenticated → 401
- [ ] **Проверить:** хешируется ли пароль при register (не plaintext в БД)

#### InstagramAccountTest.php (9 тестов)
- [ ] Список: только свои аккаунты (фильтр по `user_id`)
- [ ] Просмотр чужого → 404
- [ ] Удаление чужого → 404
- [ ] Login (добавление): мокирование `InstagramClientService::login()`
- [ ] Login: ошибка от Python → 422
- [ ] Login: валидация (login, password — required)
- [ ] Удаление своего → 200 + `assertDatabaseMissing`
- [ ] Device profiles: GET список активных
- [ ] **Проверить:** шифруется ли password при сохранении через endpoint

#### FeedTest.php (9 тестов)
- [ ] Лента: мок `getFeed()`, ответ содержит posts
- [ ] Пагинация: `max_id` передаётся в Python-клиент
- [ ] 404 для несуществующего аккаунта
- [ ] 404 для чужого аккаунта
- [ ] 422 для аккаунта без session_data
- [ ] Like: мок `addLike()`, success
- [ ] Like: 422 без media_id
- [ ] Auth: 401 / 403
- [ ] **Проверить:** seen_posts передаются при пагинации?

#### CommentTest.php (8 тестов)
- [ ] Index: мок `fetchMediaComments()`, список комментариев
- [ ] Пагинация: `min_id` передаётся
- [ ] Replies: мок `fetchCommentReplies()`
- [ ] Store: мок `commentMedia()`, POST текст комментария
- [ ] Store: 422 без text
- [ ] Ownership: 404 для чужого аккаунта
- [ ] Auth: 401 / 403
- [ ] **Проверить:** санитизация text перед отправкой?

#### SearchTest.php (8 тестов)
- [ ] Hashtag: мок `searchHashtag()`, tag + amount
- [ ] Hashtag: пагинация next_max_id
- [ ] Hashtag: валидация tag required
- [ ] Locations: мок `searchLocations()`
- [ ] Location medias: мок `searchLocationMedias()`
- [ ] Ownership: 404 для чужого аккаунта
- [ ] Auth: 401 / 403
- [ ] **Проверить:** есть ли rate-limit на search endpoints?

#### CommentGenerateTest.php (6 тестов)
- [ ] `Queue::fake()` — dispatch `GenerateCommentJob`
- [ ] Job получает правильные параметры (image_url, account_id, user_id)
- [ ] 422 без image_url
- [ ] 422 для невалидного URL
- [ ] Auth: 401 / 403
- [ ] **Проверить:** job_id возвращается в ответе для WebSocket-подписки

#### InstagramUserTest.php (5 тестов)
- [ ] Show: мок `getUserInfoByPk()`, данные профиля
- [ ] 404 для чужого аккаунта
- [ ] 422 без session_data
- [ ] 422 при ошибке Instagram
- [ ] Auth: 401
- [ ] **Проверить:** кешируются ли данные пользователя?

#### LlmSettingsTest.php (~13 тестов, admin-only)
- [ ] Index: список всех настроек
- [ ] Show: одна настройка / 404
- [ ] Store: создание + валидация
- [ ] Set default: PATCH переключает is_default
- [ ] Destroy: удаление
- [ ] Test connection: мок `LlmService::testConnection()`, success / error
- [ ] Base prompt: GET / PUT / POST reset
- [ ] Non-admin → 403
- [ ] Auth: 401 / 403
- [ ] **Проверить:** api_key шифруется при store/update?

#### AdminUserTest.php (9 тестов)
- [ ] Admin: список всех пользователей
- [ ] Non-admin → 403
- [ ] Auth: 401
- [ ] Toggle active: true→false, false→true
- [ ] Change role: user→admin, admin→user
- [ ] 404 для несуществующего user
- [ ] 422 для невалидной роли
- [ ] **Проверить:** admin не может деактивировать сам себя?
- [ ] **Проверить:** admin не может снять роль admin с последнего admin?

#### ActivityLogTest.php (10 тестов)
- [ ] Index: список логов аккаунта
- [ ] Фильтры: action, status, дата
- [ ] Stats: success_rate, avg duration, группировка
- [ ] Summary: сводка по всем аккаунтам
- [ ] 403 для чужого аккаунта (non-admin)
- [ ] Admin может видеть любые логи
- [ ] Auth: 401 / 403
- [ ] Пустой результат — корректный ответ (не ошибка)
- [ ] **Проверить:** пагинация (cursor-based через beforeId/afterId)

#### ProxyImageTest.php (6 тестов)
- [ ] Success: проксирование изображения с CDN Instagram
- [ ] Cache: второй запрос не делает HTTP-вызов (`Http::assertSentCount(1)`)
- [ ] 403 для запрещённого домена (`evil.com`)
- [ ] 403 без URL
- [ ] 404 когда CDN отвечает ошибкой
- [ ] Публичный роут: не требует авторизации
- [ ] **Проверить:** whitelist доменов — полный ли? (cdninstagram.com, scontent*.cdninstagram.com)

---

## Раздел 3. Аудит интеграционного теста (1 файл)

**Файл:** `tests/Integration/InstagramClientServiceIntegrationTest.php` (241 строка)

### 3.1 Что проверить

**Инфраструктура:**
- [ ] `skipIfPythonUnavailable()` — корректный skip, не fail, в CI
- [ ] Timeout для HTTP-запросов к Python
- [ ] `RefreshDatabase` — изоляция между тестами

**Активные тесты (не skip):**
- [ ] Python health check: GET /health → 200
- [ ] Pydantic validation: 422 на отсутствие/null session_data
- [ ] Error logging: ошибки Python записываются в ActivityLog
- [ ] Error response: структура `{ success, error_code }`, без traceback

**Пропущенные тесты (@group instagram):**
- [ ] `test_login_updates_session_data` — требует реального Instagram
- [ ] `test_get_feed_returns_posts` — требует реального Instagram
- [ ] `test_add_like_returns_success` — требует реального Instagram
- [ ] `test_fetch_media_comments_returns_comments` — требует реального Instagram
- [ ] `test_search_hashtag_returns_results` — требует реального Instagram
- [ ] **Решение:** запускать через `--group instagram` с real credentials в CI? Или fixture-based?

### 3.2 Рекомендации по расширению

- [ ] Тест на timeout Python-сервиса (медленный ответ → корректная ошибка)
- [ ] Тест на Python down → Laravel возвращает 502/503 с понятным сообщением
- [ ] Тест на некорректный JSON от Python → корректная обработка
- [ ] Тест на concurrency: два запроса к одному аккаунту одновременно

---

## Раздел 4. Аудит фабрик (6 файлов)

| # | Фабрика | States | Что проверить |
|---|---------|--------|---------------|
| 1 | `UserFactory.php` | `unverified()`, `inactive()` | Все поля модели покрыты? Пароль хешируется? |
| 2 | `InstagramAccountFactory.php` | — | `user_id` через `User::factory()`, session_data=null по умолчанию |
| 3 | `AccountActivityLogFactory.php` | `success()`, `fail()` | Все action types (`like`, `comment`, `login`, `feed`, `search`) |
| 4 | `LlmSettingFactory.php` | `default()`, `openai()`, `glm()` | Провайдер-специфичные данные корректны |
| 5 | `DeviceProfileFactory.php` | — | device_settings валидный JSON |
| 6 | `LlmSystemPromptFactory.php` | — | key уникален |

**Общий чек-лист:**
- [ ] Все поля миграции представлены в фабрике
- [ ] Nullable-поля имеют `null` или `optional()` по умолчанию
- [ ] States покрывают все значимые варианты (active/inactive, success/fail)
- [ ] Связи (`belongsTo`) используют `ModelName::factory()`, не хардкод ID
- [ ] Faker генерирует реалистичные данные (не `'test123'`)
- [ ] Нет конфликтов уникальности при массовом создании (`unique()` для login, email)

---

## Раздел 5. Кросс-уровневый анализ

### 5.1 Покрытие по архитектурным слоям

| Слой | Unit | Feature | Integration | Что может быть пропущено |
|------|------|---------|-------------|--------------------------|
| Models | 4 теста | — | — | DeviceProfile model test |
| Repositories | 5 тестов | — | — | DeviceProfileRepository |
| Services | 3 теста | — | 1 тест | — |
| Controllers | — | 10 тестов | — | Все покрыты через Feature |
| Jobs | 1 тест | — | — | Retry/failed hook |
| Events | 2 теста | — | — | — |
| Middleware | 1 тест | Через Feature | — | — |
| Console | 1 тест | — | — | — |
| Facades | — | — | — | Нет тестов для Facades |
| Providers | — | — | — | Нет тестов для bindings в AppServiceProvider |

### 5.2 Проверка непокрытых областей

- [ ] **DeviceProfile**: нет теста модели и репозитория
- [ ] **AppServiceProvider**: `register()` bindings — проверяется ли resolve через контейнер?
- [ ] **Facades**: если есть кастомные Facades — тестируются ли?
- [ ] **FormRequest**: валидация через отдельные Request-классы? Если да — покрыты ли unit-тестами?
- [ ] **Config**: `config/app.php` aliases, `config('app.instagram_salt')` — тестируется?
- [ ] **Routes**: все route-файлы (`api.php`, `channels.php`) покрыты feature-тестами?
- [ ] **Broadcasting channels**: `channels.php` авторизация — тестируется?

### 5.3 Мок-стратегия

| Что мокируется | Где | Как |
|----------------|-----|-----|
| Python API | InstagramClientServiceTest | `Http::fake()` |
| LLM API (OpenAI/GLM) | LlmServiceTest | `Http::fake()` |
| CDN Instagram | ProxyImageTest | `Http::fake()` |
| Queue | CommentGenerateTest | `Queue::fake()` |
| Events | GenerateCommentJobTest, ActivityLoggerServiceTest | `Event::fake()` |
| Interfaces (DI) | Jobs, Services | `$this->createMock()` |

**Чек-лист мок-стратегии:**
- [ ] `Http::fake()` — паттерны URL совпадают с реальными (python:8001, api.openai.com, etc.)
- [ ] `Http::fake()` — проверяется body запроса через `Http::assertSent()`
- [ ] Моки через DI — используются интерфейсы, не конкретные классы
- [ ] `Event::fake()` не блокирует нужные side-effects в тестах
- [ ] Нет "мёртвых" моков (замоканы, но assertions не проверяются)

---

## Раздел 6. Качество и паттерны

### 6.1 Code quality

- [ ] `declare(strict_types=1)` в каждом тестовом файле
- [ ] `final class` для тестовых классов? (не обязательно, но конвенция проекта)
- [ ] Имена тестов: `test_<action>_<expectation>` — информативны?
- [ ] Один assert concern на тест (не mega-тесты с 10+ assertions)
- [ ] `setUp()` / `tearDown()` используются для общего setup, не дублируют код
- [ ] Фабрики вместо raw `Model::create()` в тестах
- [ ] `actingAs()` вместо ручной авторизации

### 6.2 Соответствие конвенциям проекта (CLAUDE.md)

- [ ] `declare(strict_types=1)` в каждом PHP файле
- [ ] `{` на той же строке
- [ ] Trailing comma НЕ используется
- [ ] Массивы 2+ элементов — многострочно
- [ ] DI через конструктор, `private readonly`
- [ ] Response format: `{ success, data, message }` / `{ success, error }`

### 6.3 PHPUnit / phpunit.xml

- [ ] `stopOnFailure=true` или `false` — что предпочтительнее для CI?
- [ ] Coverage: настроен ли `<coverage>` блок?
- [ ] Test suites: Unit, Feature, Integration — все три выполняются в CI?
- [ ] Environment: `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:` — корректно для всех тестов?
- [ ] `QUEUE_CONNECTION=sync` — не маскирует ли проблемы с async jobs?
- [ ] `BROADCAST_CONNECTION=null` — не маскирует ли проблемы с events?

### 6.4 PHP CodeSniffer

- [ ] `squizlabs/php_codesniffer` установлен — запускается ли в CI?
- [ ] Настроен ли `phpcs.xml` / `.phpcs.xml`?
- [ ] Тестовые файлы включены в проверку?

---

## Раздел 7. Безопасность в тестах

### 7.1 Проверки безопасности

- [ ] Пароли хешируются при register (не plaintext в БД)
- [ ] Instagram password шифруется Accessor'ом (не plaintext)
- [ ] `api_key` LLM шифруется (не plaintext)
- [ ] `session_data` шифруется (не plaintext)
- [ ] Sanitize: session_data / password / cookie / token удаляются из логов
- [ ] Ownership check: 404 (не 403) для чужих ресурсов — не раскрывает существование
- [ ] ProxyImage: whitelist доменов — нет SSRF
- [ ] Нет SQL injection через фильтры (action, status, date range)
- [ ] Нет mass assignment: `$fillable` / `$guarded` проверены
- [ ] CSRF: API routes исключены из CSRF (Sanctum token-based)

### 7.2 Чувствительные данные в тестах

- [ ] Нет реальных Instagram credentials в тестовых файлах
- [ ] Нет реальных API ключей (OpenAI, GLM) в тестах
- [ ] `.env.testing` не содержит production-данных
- [ ] Фабрики генерируют фейковые данные (Faker)
- [ ] `test_salt_for_testing` — не совпадает с production salt

---

## Раздел 8. Рекомендации и action items

### 8.1 Высокий приоритет

- [ ] Проверить все feature-тесты: покрыт ли error-кейс каждого endpoint
- [ ] Проверить ownership checks: все endpoints с `{accountId}` / `{id}` проверяют принадлежность
- [ ] Проверить sanitize: тесты ActivityLoggerService покрывают все sensitive-поля
- [ ] Проверить шифрование: Accessor set/get roundtrip для всех encrypted полей
- [ ] Добавить тест DeviceProfile model + repository (если отсутствует)

### 8.2 Средний приоритет

- [ ] Broadcasting channels (`channels.php`): добавить тесты авторизации каналов
- [ ] FormRequest validation: выделить в отдельные классы + unit-тесты?
- [ ] Расширить интеграционный тест: timeout, Python down, invalid JSON
- [ ] Coverage: настроить порог в phpunit.xml
- [ ] Admin self-protection: admin не может деактивировать себя / снять последнюю admin-роль

### 8.3 Низкий приоритет

- [ ] Добавить `@group` аннотации для категоризации тестов
- [ ] Рассмотреть Pest PHP как альтернативу PHPUnit (лаконичнее)
- [ ] Добавить database assertions для soft deletes (если используются)
- [ ] CI pipeline: настроить `composer test` с coverage report

---

## Порядок выполнения аудита

| Этап | Действие | Приоритет |
|------|----------|-----------|
| 1 | Запустить все тесты (`composer test`), зафиксировать pass/fail | Высокий |
| 2 | Аудит feature-тестов (раздел 2) — API endpoints, безопасность | Высокий |
| 3 | Аудит service-тестов (раздел 1.3) — бизнес-логика, моки | Высокий |
| 4 | Аудит repository-тестов (раздел 1.2) — данные, фильтры | Высокий |
| 5 | Аудит безопасности (раздел 7) — шифрование, sanitize, ownership | Высокий |
| 6 | Аудит model-тестов (раздел 1.1) | Средний |
| 7 | Аудит job/event тестов (разделы 1.4–1.5) | Средний |
| 8 | Аудит интеграционного теста (раздел 3) | Средний |
| 9 | Аудит фабрик (раздел 4) | Средний |
| 10 | Кросс-уровневый анализ покрытия (раздел 5) | Средний |
| 11 | Code quality и конвенции (раздел 6) | Низкий |
| 12 | Формирование итогового отчёта с рекомендациями | Финал |
