# insta-pilot — Backend Plan (Laravel + Python)

> Детальный план backend. Основной план: [PLAN.md](PLAN.md)

---

## Фаза 1 — Авторизация и пользователи

### 1.1 Пакеты

```bash
composer require laravel/sanctum
composer require spatie/laravel-permission
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
```

### 1.2 Миграции

**add_is_active_to_users_table:**
```
users:
  + is_active  boolean  default: true
```

**add_user_id_to_instagram_accounts_table:**
```
instagram_accounts:
  + user_id  foreignId  constrained → users, cascadeOnDelete
```

> Spatie создаёт таблицы `roles`, `permissions`, `model_has_roles` и т.д. автоматически.

### 1.3 Модели

**User** (обновить):
- Добавить trait `HasRoles` (Spatie)
- Добавить trait `HasApiTokens` (Sanctum)
- `is_active` в `$fillable`
- Связь: `hasMany(InstagramAccount::class)`

**InstagramAccount** (обновить):
- `user_id` в `$fillable`
- Связь: `belongsTo(User::class)`

### 1.4 Роли

| Роль | Доступ |
|------|--------|
| `admin` | Всё + управление пользователями + настройки LLM |
| `user` | Свои аккаунты, лента, поиск |

### 1.5 AuthController (`final class`)

| Метод | Роут | Описание |
|-------|------|----------|
| `register` | `POST /api/auth/register` | Регистрация (public) |
| `login` | `POST /api/auth/login` | Вход (public) |
| `logout` | `POST /api/auth/logout` | Выход (auth) |
| `me` | `GET /api/auth/me` | Текущий пользователь (auth) |

**register — валидация:**
```
name:     required|string|max:255
email:    required|email|unique:users
password: required|string|min:8|confirmed
```

**login — валидация:**
```
email:    required|email
password: required|string
```

**login — логика:**
1. `Auth::attempt(credentials)` — если false → 401
2. Проверить `$user->is_active` — если false → 403 "Аккаунт деактивирован"
3. `$user->createToken('auth')` → вернуть token + user

**Формат ответа login:**
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "name": "...", "email": "...", "role": "admin", "is_active": true },
    "token": "1|abc..."
  },
  "message": "OK"
}
```

**me — ответ:**
```json
{
  "success": true,
  "data": { "id": 1, "name": "...", "email": "...", "role": "admin", "is_active": true },
  "message": "OK"
}
```

### 1.6 EnsureUserIsActive middleware

```php
// Проверить auth()->user()->is_active
// Если false → 403 { success: false, error: 'Аккаунт деактивирован' }
```

### 1.7 UserController (`final class`, admin only)

| Метод | Роут | Описание |
|-------|------|----------|
| `index` | `GET /api/admin/users` | Список пользователей |
| `toggleActive` | `PATCH /api/admin/users/{id}/toggle` | Вкл/выкл пользователя |
| `updateRole` | `PATCH /api/admin/users/{id}/role` | Сменить роль |

**index — ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Admin",
      "email": "admin@...",
      "role": "admin",
      "is_active": true,
      "accounts_count": 3,
      "created_at": "2026-03-10T..."
    }
  ],
  "message": "OK"
}
```

> `accounts_count` → `withCount('instagramAccounts')` в Eloquent.

**toggleActive:**
```
→ Найти user по id
→ $user->is_active = !$user->is_active
→ Нельзя деактивировать самого себя
→ Вернуть обновлённого user
```

**updateRole — валидация:**
```
role: required|in:admin,user
```

### 1.8 UserRepository

```php
interface UserRepositoryInterface {
    public function getAllWithAccountsCount(): Collection;
    public function findById(int $id): ?User;
    public function toggleActive(User $user): User;
    public function updateRole(User $user, string $role): User;
}
```

### 1.9 Routes (api.php — обновлённые)

```php
// Public
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// Authenticated + active
Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function () {
    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Instagram Accounts (фильтр по user_id; admin видит все)
    Route::prefix('accounts')->group(function () {
        Route::get('/', [InstagramAccountController::class, 'index']);
        Route::post('/login', [InstagramAccountController::class, 'login']);
        Route::get('/{id}', [InstagramAccountController::class, 'show']);
        Route::delete('/{id}', [InstagramAccountController::class, 'destroy']);
    });
});

// Admin only
Route::middleware(['auth:sanctum', EnsureUserIsActive::class, 'role:admin'])->group(function () {
    Route::prefix('admin/users')->group(function () {
        Route::get('/', [UserController::class, 'index']);
        Route::patch('/{id}/toggle', [UserController::class, 'toggleActive']);
        Route::patch('/{id}/role', [UserController::class, 'updateRole']);
    });
});
```

### 1.10 Sanctum конфигурация

**config/sanctum.php:**
- `stateful` → добавить `localhost:9000` (Vue dev)

**config/cors.php:**
- `supports_credentials` → `true`
- `allowed_origins` → `['http://localhost:9000']`

### 1.11 AdminSeeder

```php
// Создать роли
Role::create(['name' => 'admin']);
Role::create(['name' => 'user']);

// Создать admin
User::create([
    'name' => 'Admin',
    'email' => 'admin@insta-pilot.local',
    'password' => Hash::make('password'),
    'is_active' => true,
])->assignRole('admin');
```

### 1.12 Обновить InstagramAccountController

- `index()`: user → `where('user_id', auth()->id())`; admin → все
- `login()`: добавлять `'user_id' => auth()->id()` при создании
- `show()`, `destroy()`: проверка `user_id === auth()->id()` (admin — без проверки)

### Порядок реализации

1. Установить пакеты (Sanctum, Spatie)
2. Миграции (is_active, user_id, Spatie tables)
3. Обновить модели (User, InstagramAccount)
4. AdminSeeder + RoleSeeder
5. EnsureUserIsActive middleware
6. AuthController
7. UserRepository + UserController
8. Routes (api.php)
9. Обновить InstagramAccountController (user_id)
10. Настроить Sanctum (CORS, stateful)

---

## Фаза 2 — Лента аккаунта

### 2.1 Python: новые эндпоинты

**POST /account/feed**
```
Request:  { session_data: str, max_id: str | null }
Response: {
  success: bool,
  items: [
    {
      pk: str,
      media_type: int,          // 1=Photo, 2=Video, 8=Album
      thumbnail_url: str,
      video_url: str | null,
      caption_text: str,
      like_count: int,
      comment_count: int,
      has_liked: bool,
      user: { pk: str, username: str, full_name: str, profile_pic_url: str },
      taken_at: str             // ISO datetime
    }
  ],
  next_max_id: str | null       // null = конец ленты
}
```

> **instagrapi:** `cl.get_timeline_feed()` — может быть нестабильным.
> Альтернатива: `cl.user_medias_v1(user_pk, amount)` для медиа конкретного пользователя.
> Решение определить при реализации — начать с timeline, fallback на user_medias.

**POST /user/info**
```
Request:  { session_data: str, user_pk: str }
Response: {
  success: bool,
  data: {
    pk: str,
    username: str,
    full_name: str,
    profile_pic_url: str,
    biography: str,
    follower_count: int,
    following_count: int,
    media_count: int,
    is_private: bool
  }
}
```

### 2.2 Laravel: FeedController (`final class`)

| Метод | Роут | Описание |
|-------|------|----------|
| `index` | `GET /api/feed?account_id={id}&cursor={max_id}` | Получить ленту |
| `like` | `POST /api/media/{mediaPk}/like` | Лайкнуть пост |

**index — логика:**
1. Валидация: `account_id` required, `cursor` nullable
2. Загрузить аккаунт → проверить принадлежность пользователю
3. Вызвать `InstagramClientService->getFeed(sessionData, cursor)`
4. Вернуть результат

**like — логика:**
1. Body: `{ account_id }`
2. Загрузить аккаунт → проверить принадлежность
3. Вызвать `InstagramClientService->likeMedia(sessionData, mediaPk)`

### 2.3 Laravel: InstagramUserController (`final class`)

| Метод | Роут | Описание |
|-------|------|----------|
| `show` | `GET /api/instagram-user/{userPk}?account_id={id}` | Инфо о пользователе |

### 2.4 Обновить InstagramClientService

Новые методы:
```php
public function getFeed(string $sessionData, ?string $maxId = null): array;
public function getUserInfoByPk(string $sessionData, string $userPk): array;
// likeMedia — уже может существовать, проверить
```

### 2.5 Routes (добавить)

```php
// В authenticated group
Route::get('/feed', [FeedController::class, 'index']);
Route::post('/media/{mediaPk}/like', [FeedController::class, 'like']);
Route::get('/instagram-user/{userPk}', [InstagramUserController::class, 'show']);
```

### Порядок реализации

1. Python: `POST /account/feed`
2. Python: `POST /user/info`
3. Laravel: InstagramClientService (getFeed, getUserInfoByPk)
4. Laravel: FeedController + routes
5. Laravel: InstagramUserController + routes

---

## Фаза 3 — Поиск по тегам/гео

### 3.1 Python: новые эндпоинты

**POST /search/hashtag**
```
Request:  { session_data: str, hashtag: str, amount: int = 30 }
Response: { success: bool, items: [/* media format */] }
```
> instagrapi: `cl.hashtag_medias_recent(hashtag, amount)`

**POST /search/locations**
```
Request:  { session_data: str, query: str }
Response: {
  success: bool,
  locations: [
    { pk: int, name: str, address: str, lat: float, lng: float }
  ]
}
```
> instagrapi: `cl.fbsearch_places(query)`

**POST /search/location**
```
Request:  { session_data: str, location_pk: int, amount: int = 30 }
Response: { success: bool, items: [/* media format */] }
```
> instagrapi: `cl.location_medias_recent(location_pk, amount)`

**POST /media/comment**
```
Request:  { session_data: str, media_pk: str, text: str }
Response: { success: bool, comment_pk: str }
```
> instagrapi: `cl.media_comment(media_pk, text)`

### 3.2 Laravel: SearchController (`final class`)

| Метод | Роут | Описание |
|-------|------|----------|
| `hashtag` | `GET /api/search/hashtag?tag={t}&account_id={id}&amount=30` | По хэштегу |
| `locations` | `GET /api/search/locations?query={q}&account_id={id}` | Найти места |
| `locationMedias` | `GET /api/search/location?location_pk={pk}&account_id={id}&amount=30` | Медиа места |

Каждый метод:
1. Валидация параметров
2. Загрузить аккаунт → проверить принадлежность
3. Вызвать Python через InstagramClientService
4. Вернуть результат

### 3.3 Laravel: CommentController (`final class`)

| Метод | Роут | Описание |
|-------|------|----------|
| `store` | `POST /api/media/{mediaPk}/comment` | Отправить комментарий |

**store — body:**
```
account_id: required|integer
text:       required|string|max:2200
```

### 3.4 Обновить InstagramClientService

```php
public function searchHashtag(string $sessionData, string $hashtag, int $amount = 30): array;
public function searchLocations(string $sessionData, string $query): array;
public function searchLocationMedias(string $sessionData, int $locationPk, int $amount = 30): array;
public function commentMedia(string $sessionData, string $mediaPk, string $text): array;
```

### 3.5 Routes (добавить)

```php
// В authenticated group
Route::prefix('search')->group(function () {
    Route::get('/hashtag', [SearchController::class, 'hashtag']);
    Route::get('/locations', [SearchController::class, 'locations']);
    Route::get('/location', [SearchController::class, 'locationMedias']);
});

Route::post('/media/{mediaPk}/comment', [CommentController::class, 'store']);
```

### Порядок реализации

1. Python: /search/hashtag, /search/locations, /search/location
2. Python: /media/comment
3. Laravel: InstagramClientService (4 новых метода)
4. Laravel: SearchController + routes
5. Laravel: CommentController + routes

---

## Фаза 4 — LLM интеграция

### 4.1 Миграция: create_llm_settings_table

```
llm_settings:
  id             bigIncrements
  provider       string         default: 'z_ai'
  api_key        text           encrypted (Accessor)
  model_name     string         default: 'glm-4.6v'
  system_prompt  text
  tone           string         default: 'positive'   // positive | negative | neutral
  created_at / updated_at
```

> Singleton (одна запись). Admin управляет глобально.

### 4.2 Модель LlmSetting

- Encrypted: `api_key` через Accessor (аналогично InstagramAccount.instagram_password)
- Fillable: provider, api_key, model_name, system_prompt, tone

### 4.3 LlmSettingsController (`final class`, admin)

| Метод | Роут | Описание |
|-------|------|----------|
| `show` | `GET /api/settings/llm` | Получить настройки (api_key замаскирован) |
| `update` | `PUT /api/settings/llm` | Обновить настройки |
| `testConnection` | `POST /api/settings/llm/test` | Проверить API key |

**update — валидация:**
```
provider:      required|in:z_ai
api_key:       required|string
model_name:    required|string
system_prompt: required|string
tone:          required|in:positive,negative,neutral
```

**show — маскировка api_key:**
```
api_key_masked: "sk-...abc" (первые 3 + последние 3 символа)
```

### 4.4 LlmService

```php
interface LlmServiceInterface {
    public function generateComment(string $imageUrl, string $captionText): string;
}
```

**Реализация (ZAiLlmService):**
1. Прочитать LlmSetting из БД (singleton → `LlmSetting::first()`)
2. Скачать изображение по URL → temp file / base64
3. Сформировать запрос к z.ai API:
   - model: из настроек
   - system: system_prompt + tone instruction
   - user: изображение (base64) + caption_text
4. HTTP-запрос к z.ai API → получить текст комментария
5. Вернуть результат

### 4.5 GenerateCommentJob (`ShouldQueue`)

```php
public function __construct(
    public string $jobId,      // UUID для WebSocket канала
    public string $imageUrl,
    public string $captionText,
) {}

public function handle(LlmServiceInterface $llmService): void
{
    // Шаг 1: Broadcast "Загрузка изображения..."
    broadcast(new CommentGenerationProgress($this->jobId, 'downloading', 'Загрузка изображения...'));

    // Шаг 2: Broadcast "Анализ изображения..."
    broadcast(new CommentGenerationProgress($this->jobId, 'processing', 'Анализ изображения...'));

    // Шаг 3: Генерация
    $comment = $llmService->generateComment($this->imageUrl, $this->captionText);

    // Шаг 4: Broadcast результат
    broadcast(new CommentGenerationProgress($this->jobId, 'completed', 'Комментарий готов', $comment));
}

public function failed(Throwable $e): void
{
    broadcast(new CommentGenerationProgress($this->jobId, 'failed', 'Ошибка: ' . $e->getMessage()));
}
```

### 4.6 CommentGenerationProgress event

```php
class CommentGenerationProgress implements ShouldBroadcast
{
    public function __construct(
        public string $jobId,
        public string $status,      // downloading | processing | completed | failed
        public string $message,
        public ?string $comment = null,
    ) {}

    public function broadcastOn(): Channel
    {
        return new PrivateChannel("comment-generation.{$this->jobId}");
    }
}
```

**channels.php (broadcasting auth):**
```php
Broadcast::channel('comment-generation.{jobId}', fn () => auth()->check());
```

### 4.7 CommentGenerateController (`final class`)

| Метод | Роут | Описание |
|-------|------|----------|
| `generate` | `POST /api/comments/generate` | Запустить генерацию |

**generate — body:**
```
image_url:    required|url
caption_text: nullable|string
```

**generate — логика:**
1. Сгенерировать `$jobId = Str::uuid()`
2. `GenerateCommentJob::dispatch($jobId, $imageUrl, $captionText)`
3. Return `{ success: true, data: { job_id: $jobId } }`

### 4.8 Laravel Reverb

**Установка:**
```bash
php artisan install:broadcasting
# Выбрать Reverb
```

**`.env` (добавить):**
```
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=insta-pilot
REVERB_APP_KEY=local-reverb-key
REVERB_APP_SECRET=local-reverb-secret
REVERB_HOST=0.0.0.0
REVERB_PORT=8080
REVERB_SCHEME=http
```

### 4.9 Routes (добавить)

```php
// В authenticated group
Route::post('/comments/generate', [CommentGenerateController::class, 'generate']);

// В admin group
Route::prefix('settings/llm')->group(function () {
    Route::get('/', [LlmSettingsController::class, 'show']);
    Route::put('/', [LlmSettingsController::class, 'update']);
    Route::post('/test', [LlmSettingsController::class, 'testConnection']);
});
```

### 4.10 Docker: новые сервисы

**reverb:**
```yaml
reverb:
  build:
    context: .
    dockerfile: docker/laravel/Dockerfile
  command: php artisan reverb:start --host=0.0.0.0 --port=8080
  ports:
    - "8080:8080"
  environment:
    # те же env что у laravel
  depends_on:
    - redis
    - postgres
```

**queue-worker:**
```yaml
queue-worker:
  build:
    context: .
    dockerfile: docker/laravel/Dockerfile
  command: php artisan queue:work redis --queue=default --tries=3
  environment:
    # те же env что у laravel
  depends_on:
    - redis
    - postgres
```

### 4.11 LlmService — DI binding

```php
// AppServiceProvider
$this->app->singleton(LlmServiceInterface::class, ZAiLlmService::class);
```

### Порядок реализации

1. Миграция + модель LlmSetting
2. LlmSettingsController + routes (admin)
3. LlmService (ZAiLlmService + z.ai API)
4. Bind в AppServiceProvider
5. CommentGenerationProgress event
6. GenerateCommentJob
7. CommentGenerateController + route
8. `php artisan install:broadcasting` (Reverb)
9. channels.php (авторизация канала)
10. Docker: reverb + queue-worker сервисы
11. `.env` обновить (Reverb credentials)
12. Тестирование E2E
