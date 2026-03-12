# insta-pilot — Activity Logging Backend Plan (Laravel + Python)

> Детальный план backend логирования активности. Основной план: [PLAN.md](PLAN.md)

---

## Фаза 5 — Мониторинг активности аккаунтов

### 5.1 Миграция: create_account_activity_logs_table

```
account_activity_logs:
  id                    bigIncrements
  instagram_account_id  foreignId → instagram_accounts, cascadeOnDelete
  user_id               foreignId → users, cascadeOnDelete
  action                string                  // login, fetch_feed, like, comment, ...
  status                string                  // success, error, rate_limited, ...
  request_payload       json, nullable          // санитизированные данные запроса
  response_summary      json, nullable          // краткий результат
  error_message         text, nullable
  error_code            string, nullable        // rate_limited, challenge_required, ...
  duration_ms           integer, nullable       // время выполнения в мс
  created_at            timestamp
```

> Без `updated_at` — логи иммутабельны (append-only).

**Индексы:**
- `(instagram_account_id, created_at)` — composite, для выборки логов по аккаунту с сортировкой
- `(action)` — фильтрация по типу действия
- `(status)` — фильтрация по статусу
- `(created_at)` — для cleanup старых записей и сортировки

---

### 5.2 Модель AccountActivityLog

```php
class AccountActivityLog extends Model {
    public $timestamps = false;

    protected $fillable = [
        'instagram_account_id', 'user_id', 'action', 'status',
        'request_payload', 'response_summary', 'error_message',
        'error_code', 'duration_ms', 'created_at',
    ];

    protected $casts = [
        'request_payload'  => 'array',
        'response_summary' => 'array',
        'created_at'       => 'datetime',
    ];

    // Relations
    public function instagramAccount(): BelongsTo → InstagramAccount
    public function user(): BelongsTo → User
}
```

---

### 5.3 Константы: ActionType и ActionStatus

**ActionType:**

| Значение | Описание |
|----------|----------|
| `login` | Авторизация Instagram |
| `fetch_feed` | Загрузка ленты |
| `like` | Лайк поста |
| `comment` | Комментарий к посту |
| `search_hashtag` | Поиск по хэштегу |
| `search_locations` | Поиск локаций |
| `search_location_medias` | Медиа по локации |
| `fetch_user_info` | Информация о пользователе Instagram |
| `generate_comment` | LLM-генерация комментария |

**ActionStatus:**

| Значение | Описание |
|----------|----------|
| `success` | Успешное выполнение |
| `error` | Общая ошибка |
| `rate_limited` | Лимит Instagram (429 / "please wait") |
| `challenge_required` | Требуется подтверждение (SMS/email) |
| `login_required` | Сессия истекла |
| `timeout` | Таймаут запроса |

> Реализовать как PHP Enum (PHP 8.1+) или класс с константами.

---

### 5.4 ActivityLoggerService

```php
interface ActivityLoggerServiceInterface {
    public function log(
        int $accountId,
        int $userId,
        string $action,
        string $status,
        ?array $requestPayload = null,
        ?array $responseSummary = null,
        ?string $errorMessage = null,
        ?string $errorCode = null,
        ?int $durationMs = null,
    ): AccountActivityLog;
}
```

**Реализация (ActivityLoggerService):**
1. Создать запись в `account_activity_logs`
2. Dispatch событие `ActivityLogCreated` (broadcast → WebSocket)
3. Return модель

**Санитизация request_payload:**

Запрещено логировать:
- `instagram_password`
- `session_data` (полный dump)
- `cookie`, `token`

Допустимо:
- `instagram_login`
- `max_id` / `cursor`
- `hashtag`, `location_pk`
- `media_pk`
- `has_session: true/false` (вместо session_data)
- `has_proxy: true/false` (вместо proxy string)

**Пример `response_summary` по типам действий:**

| Action | response_summary |
|--------|-----------------|
| `fetch_feed` | `{"items_count": 30, "has_more": true}` |
| `like` | `{"media_pk": "3456789"}` |
| `comment` | `{"media_pk": "3456789", "comment_pk": "999"}` |
| `search_hashtag` | `{"results_count": 25}` |
| `search_locations` | `{"results_count": 8}` |
| `login` | `{"session_restored": false}` |
| `fetch_user_info` | `{"user_pk": "12345", "username": "john"}` |
| `generate_comment` | `{"comment_length": 45}` |

---

### 5.5 ActivityLogCreated event (ShouldBroadcast)

```php
class ActivityLogCreated implements ShouldBroadcast {
    public function __construct(
        public AccountActivityLog $log,
    ) {}

    public function broadcastOn(): Channel
    {
        return new PrivateChannel("account-activity.{$this->log->instagram_account_id}");
    }

    public function broadcastWith(): array
    {
        return [
            'id'               => $this->log->id,
            'action'           => $this->log->action,
            'status'           => $this->log->status,
            'error_message'    => $this->log->error_message,
            'error_code'       => $this->log->error_code,
            'duration_ms'      => $this->log->duration_ms,
            'response_summary' => $this->log->response_summary,
            'created_at'       => $this->log->created_at->toISOString(),
        ];
    }
}
```

**channels.php:**
```php
Broadcast::channel('account-activity.{accountId}', function ($user, $accountId) {
    // Admin видит всё, user — только свои аккаунты
    if ($user->hasRole('admin')) {
        return true;
    }
    return InstagramAccount::where('id', $accountId)
        ->where('user_id', $user->id)
        ->exists();
});
```

> Зависит от Laravel Reverb (Фаза 4). Без Reverb — real-time не работает, но логирование и REST API работают.

---

### 5.6 ActivityLogController (`final class`)

| Метод | Роут | Описание |
|-------|------|----------|
| `index` | `GET /api/accounts/{accountId}/activity` | Логи аккаунта (cursor-пагинация) |
| `stats` | `GET /api/accounts/{accountId}/activity/stats` | Агрегированная статистика |
| `summary` | `GET /api/activity/summary` | Обзор всех аккаунтов |

---

**index — query параметры:**
```
per_page:   integer, default 100, max 100
before_id:  integer, nullable           // cursor для "загрузить ещё"
action:     string, nullable            // фильтр: login, like, comment, ...
status:     string, nullable            // фильтр: success, error, rate_limited, ...
date_from:  string (Y-m-d), nullable
date_to:    string (Y-m-d), nullable
```

**index — логика:**
1. Найти аккаунт → проверить принадлежность (user) или admin
2. Query с фильтрами, `orderBy('id', 'desc')`, `limit(per_page)`
3. Если `before_id` → `where('id', '<', before_id)`
4. Return:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 5001,
        "action": "like",
        "status": "success",
        "request_payload": { "media_pk": "3456789" },
        "response_summary": { "media_pk": "3456789" },
        "error_message": null,
        "error_code": null,
        "duration_ms": 230,
        "created_at": "2026-03-12T14:32:01.000000Z"
      }
    ],
    "has_more": true,
    "total": 10000
  },
  "message": "OK"
}
```

> Cursor-пагинация (`before_id`) вместо offset — эффективнее для append-only таблиц и корректно работает при real-time вставках (offset смещается при новых записях).

---

**stats — логика:**
1. Проверить доступ к аккаунту
2. Агрегация через SQL GROUP BY:
   - `COUNT(*)` total
   - `COUNT(*) WHERE DATE(created_at) = today` — today
   - `COUNT(*) / COUNT(*) WHERE status = success` — success_rate
   - `GROUP BY action` + `SUM(CASE WHEN status = 'success' ...)` — by_action
   - `GROUP BY status` — by_status
   - `AVG(duration_ms)` — avg_duration
   - Последняя ошибка — `WHERE status != 'success' ORDER BY id DESC LIMIT 1`

**stats — ответ:**
```json
{
  "success": true,
  "data": {
    "total": 10000,
    "today": 56,
    "success_rate": 95.2,
    "by_action": {
      "like":           { "total": 500, "success": 480, "error": 20 },
      "comment":        { "total": 100, "success": 95,  "error": 5 },
      "fetch_feed":     { "total": 200, "success": 198, "error": 2 },
      "search_hashtag": { "total": 300, "success": 300, "error": 0 }
    },
    "by_status": {
      "success":            1100,
      "error":                80,
      "rate_limited":         34,
      "challenge_required":    4,
      "timeout":               6
    },
    "avg_duration_ms": 450,
    "last_error": {
      "action": "like",
      "error_message": "Rate limit exceeded",
      "error_code": "rate_limited",
      "created_at": "2026-03-12T14:00:00.000000Z"
    }
  },
  "message": "OK"
}
```

---

**summary — логика:**
1. User → только свои аккаунты; Admin → все
2. Для каждого аккаунта: JOIN + агрегация (total, today, errors, success_rate, last_activity, last_error)

**summary — ответ:**
```json
{
  "success": true,
  "data": [
    {
      "account_id": 1,
      "instagram_login": "user1",
      "total_actions": 1234,
      "today_actions": 56,
      "error_count_today": 3,
      "success_rate": 95.2,
      "last_activity_at": "2026-03-12T14:32:01.000000Z",
      "last_error": "Rate limit exceeded",
      "last_error_at": "2026-03-12T14:00:00.000000Z"
    }
  ],
  "message": "OK"
}
```

---

### 5.7 ActivityLogRepository

```php
interface ActivityLogRepositoryInterface {
    /**
     * Логи аккаунта с фильтрами и cursor-пагинацией.
     */
    public function getByAccount(
        int $accountId,
        ?string $action = null,
        ?string $status = null,
        ?string $dateFrom = null,
        ?string $dateTo = null,
        int $perPage = 100,
        ?int $beforeId = null,
    ): array; // { items, has_more, total }

    /**
     * Агрегированная статистика по аккаунту.
     */
    public function getStatsByAccount(int $accountId): array;

    /**
     * Обзор всех аккаунтов (или по user_id).
     */
    public function getSummary(?int $userId = null): Collection;

    /**
     * Удалить логи старше N дней.
     */
    public function pruneOlderThan(int $days): int;
}
```

---

### 5.8 Routes

```php
// В authenticated + active group
Route::prefix('accounts/{accountId}/activity')->group(function () {
    Route::get('/', [ActivityLogController::class, 'index']);
    Route::get('/stats', [ActivityLogController::class, 'stats']);
});

Route::get('/activity/summary', [ActivityLogController::class, 'summary']);
```

---

### 5.9 Python: структурированные ошибки

Обновить Python-сервис — при ошибках от instagrapi возвращать `error_code` помимо текста:

**Текущий формат (до):**
```json
{ "success": false, "error": "Challenge required" }
```

**Новый формат (после):**
```json
{
  "success": false,
  "error": "Challenge required",
  "error_code": "challenge_required"
}
```

**Маппинг ошибок instagrapi → error_code:**

| Исключение instagrapi | error_code |
|----------------------|------------|
| `ChallengeRequired` | `challenge_required` |
| `LoginRequired` | `login_required` |
| `PleaseWaitFewMinutes` | `rate_limited` |
| `FeedbackRequired` | `rate_limited` |
| `ClientThrottledError` | `rate_limited` |
| `ConnectTimeout` / `ReadTimeout` | `timeout` |
| Остальные | `error` |

**Где реализовать:**
- `python-service/main.py` — в каждом endpoint обернуть `try/except` с маппингом
- Вынести маппинг в утилиту `error_to_code(exception)` → `str`

---

### 5.10 Интеграция в InstagramClientService

Обновить `InstagramClientService` — после каждого вызова Python API логировать результат.

**Паттерн (пример для getFeed):**
```php
public function getFeed(int $accountId, string $sessionData, ?string $maxId = null): array
{
    $start = microtime(true);

    try {
        $result = $this->callPython('/account/feed', [
            'session_data' => $sessionData,
            'max_id'       => $maxId,
        ]);

        $durationMs = (int) ((microtime(true) - $start) * 1000);

        $this->activityLogger->log(
            accountId:       $accountId,
            userId:          auth()->id(),
            action:          'fetch_feed',
            status:          'success',
            requestPayload:  ['max_id' => $maxId],
            responseSummary: ['items_count' => count($result['items'] ?? [])],
            durationMs:      $durationMs,
        );

        return $result;
    } catch (\Exception $e) {
        $durationMs = (int) ((microtime(true) - $start) * 1000);

        $this->activityLogger->log(
            accountId:    $accountId,
            userId:       auth()->id(),
            action:       'fetch_feed',
            status:       $this->detectErrorCode($e) ?? 'error',
            errorMessage: $e->getMessage(),
            errorCode:    $this->detectErrorCode($e),
            durationMs:   $durationMs,
        );

        throw $e;
    }
}
```

**detectErrorCode — определение типа ошибки:**
```php
private function detectErrorCode(\Exception $e): ?string
{
    // Вариант 1: если Python вернул error_code
    if ($e instanceof PythonApiException && $e->getErrorCode()) {
        return $e->getErrorCode();
    }

    // Вариант 2: парсинг текста ошибки
    $message = strtolower($e->getMessage());

    return match (true) {
        str_contains($message, 'rate limit')
            || str_contains($message, 'please wait')
            || str_contains($message, 'feedback_required')       => 'rate_limited',
        str_contains($message, 'challenge')                      => 'challenge_required',
        str_contains($message, 'login_required')                 => 'login_required',
        str_contains($message, 'timeout')                        => 'timeout',
        default                                                  => null,
    };
}
```

**Методы для обновления (все в InstagramClientService):**
- `login()` → action: `login`
- `getFeed()` → action: `fetch_feed`
- `likeMedia()` → action: `like`
- `commentMedia()` → action: `comment`
- `searchHashtag()` → action: `search_hashtag`
- `searchLocations()` → action: `search_locations`
- `searchLocationMedias()` → action: `search_location_medias`
- `getUserInfoByPk()` → action: `fetch_user_info`

> DI: добавить `ActivityLoggerServiceInterface` в конструктор `InstagramClientService`.

---

### 5.11 Интеграция в GenerateCommentJob (Фаза 4)

```php
public function handle(LlmServiceInterface $llmService, ActivityLoggerServiceInterface $logger): void
{
    $start = microtime(true);

    try {
        $comment = $llmService->generateComment($this->imageUrl, $this->captionText);
        $durationMs = (int) ((microtime(true) - $start) * 1000);

        $logger->log(
            accountId:       $this->accountId,
            userId:          $this->userId,
            action:          'generate_comment',
            status:          'success',
            responseSummary: ['comment_length' => mb_strlen($comment)],
            durationMs:      $durationMs,
        );

        // ... broadcast result
    } catch (\Exception $e) {
        $durationMs = (int) ((microtime(true) - $start) * 1000);

        $logger->log(
            accountId:    $this->accountId,
            userId:       $this->userId,
            action:       'generate_comment',
            status:       'error',
            errorMessage: $e->getMessage(),
            durationMs:   $durationMs,
        );

        // ... broadcast error
        throw $e;
    }
}
```

> Для этого в `GenerateCommentJob` нужно добавить `accountId` и `userId` (передавать при dispatch).

---

### 5.12 DI binding

```php
// AppServiceProvider::register()
$this->app->singleton(ActivityLoggerServiceInterface::class, ActivityLoggerService::class);
$this->app->bind(ActivityLogRepositoryInterface::class, ActivityLogRepository::class);
```

---

### 5.13 Artisan Command: PruneActivityLogs

```php
// app/Console/Commands/PruneActivityLogs.php

// Удалить логи старше N дней
// Использование: php artisan activity:prune --days=90
// По умолчанию: 90 дней

// Логика:
// 1. $count = $repository->pruneOlderThan($days)
// 2. $this->info("Удалено {$count} записей старше {$days} дней")

// Schedule (app/Console/Kernel.php или bootstrap/app.php):
// $schedule->command('activity:prune --days=90')->daily();
```

---

### 5.14 Тесты

**Feature тесты:**
- `ActivityLogControllerTest`:
  - `index` — проверить cursor-пагинацию, фильтры, доступ (user vs admin)
  - `stats` — проверить агрегацию, формат ответа
  - `summary` — проверить фильтрацию по user_id
  - Проверить 403 при доступе к чужому аккаунту

**Unit тесты:**
- `ActivityLoggerServiceTest`:
  - Логирование создаёт запись в БД
  - Dispatch ActivityLogCreated event
- `ActivityLogRepositoryTest`:
  - `getByAccount` с фильтрами
  - `getStatsByAccount` — корректная агрегация
  - `pruneOlderThan` — удаление старых записей

---

### Порядок реализации

1. Миграция `create_account_activity_logs_table`
2. Модель `AccountActivityLog`
3. `ActivityLoggerService` (Interface + Implementation + bind)
4. `ActivityLogRepository` (Interface + Implementation + bind)
5. `ActivityLogCreated` event (ShouldBroadcast)
6. `channels.php` — авторизация канала `account-activity.{accountId}`
7. `ActivityLogController` + routes
8. Python: обновить error responses (добавить `error_code`)
9. Интеграция в `InstagramClientService` (все методы)
10. Интеграция в `GenerateCommentJob` (Фаза 4)
11. `PruneActivityLogs` command + schedule
12. Тесты
