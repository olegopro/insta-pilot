# insta-pilot — Фаза 4: LLM интеграция + WebSocket (Пошаговый план)

> Детальный план реализации Фазы 4 с разбивкой на тестируемые шаги.
> Основные планы: [PLAN.md](PLAN.md) | [PLAN-EXTEND-BACK.md](PLAN-EXTEND-BACK.md) (п. 4.1–4.8) | [PLAN-EXTEND-FRONT.md](PLAN-EXTEND-FRONT.md) (п. 4.9–4.14)
> Vision API: [vision-api-guide.md](vision-api-guide.md) | Протокол отладки: [DEBUG_PROTOCOL.md](DEBUG_PROTOCOL.md)

---

## Текущее состояние

- Фаза 3 (поиск + комментарии) **завершена**: SearchPage, PostDetailModal, CommentController, SearchController — всё работает
- PostDetailModal: кнопка «Сгенерировать» уже есть, но `disable` — ждёт Фазу 4 ([PostDetailModal.vue](frontend-vue/src/features/post-detail/ui/PostDetailModal.vue))
- Queue: Redis в docker-compose есть, `config/queue.php` настроен (driver = database, но redis driver готов)
- Broadcasting: **не установлен** — нет `config/broadcasting.php`, нет Reverb
- Docker: только 5 сервисов (vue, laravel, python, postgres, redis) — нет reverb, queue-worker

---

## Шаг 1 — Инфраструктура: Laravel Reverb + Queue Worker + Docker

**Цель:** поднять WebSocket-сервер и обработчик очередей, убедиться что broadcasting работает.

### Backend

1. **Установить Laravel Reverb** (WebSocket-сервер):
   ```bash
   docker compose exec laravel php artisan install:broadcasting
   ```
   Это создаст:
   - `config/broadcasting.php`
   - `routes/channels.php`
   - `.env` переменные `REVERB_*`
   - `config/reverb.php`

2. **Настроить `.env`** (root, для docker-compose):
   ```env
   BROADCAST_CONNECTION=reverb
   QUEUE_CONNECTION=redis

   REVERB_APP_ID=insta-pilot
   REVERB_APP_KEY=insta-pilot-key
   REVERB_APP_SECRET=insta-pilot-secret
   REVERB_HOST=reverb
   REVERB_PORT=8080
   REVERB_SCHEME=http
   ```

3. **Обновить `docker-compose.yml`** — добавить 2 новых сервиса:

   ```yaml
   reverb:
     build: ./docker/laravel
     working_dir: /var/www
     command: php artisan reverb:start --host=0.0.0.0 --port=8080
     volumes:
       - ./backend-laravel:/var/www
     ports:
       - "8080:8080"
     depends_on:
       - redis
     env_file:
       - .env

   queue-worker:
     build: ./docker/laravel
     working_dir: /var/www
     command: php artisan queue:work redis --sleep=3 --tries=3 --timeout=90
     volumes:
       - ./backend-laravel:/var/www
     depends_on:
       - redis
       - laravel
     env_file:
       - .env
   ```

4. **Переключить `QUEUE_CONNECTION`** с `database` на `redis` в `.env`

### Тестирование шага 1

```bash
# 1. Пересобрать и запустить
docker compose up -d --build reverb queue-worker

# 2. Проверить что Reverb слушает
docker compose logs reverb
# Ожидаемо: "Starting server on 0.0.0.0:8080"

# 3. Проверить WebSocket подключение через wscat
npx wscat -c ws://localhost:8080/app/insta-pilot-key
# Ожидаемо: подключение установлено, получено {"event":"pusher:connection_established",...}

# 4. Проверить queue-worker
docker compose logs queue-worker
# Ожидаемо: "Processing jobs from the [default] queue"
```

---

## Шаг 2 — LLM Settings: Backend (модель, миграция, CRUD)

**Цель:** хранить настройки LLM-провайдера в БД, предоставить API для управления.

> Связь с планом: [PLAN.md](PLAN.md) п. 4.1, 4.2

### Новые файлы

```
backend-laravel/
├── database/migrations/
│   └── 2026_03_16_000001_create_llm_settings_table.php
├── app/Models/
│   └── LlmSetting.php
├── app/Repositories/
│   ├── LlmSettingsRepositoryInterface.php
│   └── LlmSettingsRepository.php
├── app/Http/Controllers/
│   └── LlmSettingsController.php
```

### 2.1 Миграция `llm_settings`

```
llm_settings:
  id              bigIncrements
  provider        string              // 'glm' | 'openai'
  api_key         text                // зашифрован через Accessors
  model_name      string              // 'glm-4.6v', 'gpt-4o', etc.
  system_prompt   text, nullable      // системный промпт для генерации
  tone            string, default 'friendly'  // тон: friendly, professional, casual, humorous
  is_default      boolean, default false      // какой провайдер используется
  created_at / updated_at  timestamps
```

> Таблица содержит **несколько строк** (по одной на провайдера). Поле `is_default` — какой провайдер активен.
> `api_key` шифруется аналогично `instagram_password` в `InstagramAccount` ([Models/InstagramAccount.php](backend-laravel/app/Models/InstagramAccount.php)).

### 2.2 Модель LlmSetting

```php
class LlmSetting extends Model {
    protected $fillable = [
        'provider', 'api_key', 'model_name',
        'system_prompt', 'tone', 'is_default'
    ];

    protected $casts = ['is_default' => 'boolean'];
    protected $hidden = ['api_key'];

    // Accessors для шифрования api_key (как instagram_password)
}
```

### 2.3 LlmSettingsRepository

```php
interface LlmSettingsRepositoryInterface {
    public function getAll(): Collection;
    public function getDefault(): ?LlmSetting;
    public function upsert(string $provider, array $data): LlmSetting;
    public function setDefault(int $id): void;
    public function delete(int $id): void;
}
```

### 2.4 LlmSettingsController (`final class`)

| Метод | Роут | Описание |
|-------|------|----------|
| `index` | `GET /api/llm-settings` | Все провайдеры (без api_key) |
| `show` | `GET /api/llm-settings/{id}` | Конкретный провайдер |
| `store` | `POST /api/llm-settings` | Создать/обновить провайдера |
| `setDefault` | `PATCH /api/llm-settings/{id}/default` | Установить провайдер по умолчанию |
| `destroy` | `DELETE /api/llm-settings/{id}` | Удалить провайдера |
| `testConnection` | `POST /api/llm-settings/test` | Тест подключения к API |

> Все роуты — `admin` only (middleware `role:admin`).

### 2.5 Routes

```php
Route::middleware('role:admin')->prefix('llm-settings')->group(function () {
    Route::get('/', [LlmSettingsController::class, 'index']);
    Route::post('/', [LlmSettingsController::class, 'store']);
    Route::get('/{id}', [LlmSettingsController::class, 'show']);
    Route::patch('/{id}/default', [LlmSettingsController::class, 'setDefault']);
    Route::delete('/{id}', [LlmSettingsController::class, 'destroy']);
    Route::post('/test', [LlmSettingsController::class, 'testConnection']);
});
```

### 2.6 DI binding

```php
// AppServiceProvider::register()
$this->app->bind(LlmSettingsRepositoryInterface::class, LlmSettingsRepository::class);
```

### Тестирование шага 2

```bash
# 1. Миграция
docker compose exec laravel php artisan migrate

# 2. Создать настройку через cURL (DEBUG_PROTOCOL.md шаг 4)
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@insta-pilot.local","password":"password"}' | jq -r '.data.token')

# 3. Создать GLM провайдер
curl -s -X POST http://localhost:8000/api/llm-settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider":"glm","api_key":"test-key","model_name":"glm-4.6v","tone":"friendly"}' | jq .

# 4. Получить список
curl -s http://localhost:8000/api/llm-settings \
  -H "Authorization: Bearer $TOKEN" | jq .

# 5. Установить по умолчанию
curl -s -X PATCH http://localhost:8000/api/llm-settings/1/default \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Шаг 3 — LLM Settings: Frontend (страница настроек)

**Цель:** админ может управлять LLM-провайдерами через UI.

> Связь с планом: [PLAN.md](PLAN.md) п. 4.9, 4.10

### Новые файлы

```
frontend-vue/src/
├── entities/
│   └── llm-settings/
│       ├── model/
│       │   ├── types.ts              # LlmSetting, LlmProvider, LlmTone
│       │   ├── apiTypes.ts           # LlmSettingApi (snake_case)
│       │   ├── llmSettingsStore.ts   # Pinia store
│       │   └── constants.ts          # PROVIDERS, TONES, MODELS_BY_PROVIDER
│       └── index.ts
├── pages/
│   └── llm-settings/
│       ├── ui/
│       │   └── LlmSettingsPage.vue
│       └── index.ts
```

### 3.1 types.ts

```typescript
export type LlmProvider = 'glm' | 'openai'
export type LlmTone = 'friendly' | 'professional' | 'casual' | 'humorous'

export interface LlmSetting {
  id: number
  provider: LlmProvider
  modelName: string
  systemPrompt: Nullable<string>
  tone: LlmTone
  isDefault: boolean
}
```

### 3.2 constants.ts

Доступные провайдеры, модели и тона — из [vision-api-guide.md](vision-api-guide.md):

```typescript
export const PROVIDERS: Record<LlmProvider, string> = {
  glm: 'GLM (Z.ai / Zhipu AI)',
  openai: 'OpenAI'
}

export const MODELS_BY_PROVIDER: Record<LlmProvider, { value: string; label: string }[]> = {
  glm: [
    { value: 'glm-4.6v', label: 'GLM-4.6V (flagship, 128K)' },
    { value: 'glm-4.6v-flashx', label: 'GLM-4.6V-FlashX (быстрый)' },
    { value: 'glm-4.6v-flash', label: 'GLM-4.6V-Flash (бесплатный)' }
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (flagship, 128K)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o-mini (дешевле)' },
    { value: 'gpt-4.1', label: 'GPT-4.1 (1M контекст)' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1-mini (облегчённый)' }
  ]
}

export const TONES: Record<LlmTone, string> = {
  friendly: 'Дружелюбный',
  professional: 'Профессиональный',
  casual: 'Непринуждённый',
  humorous: 'Юмористический'
}
```

### 3.3 LlmSettingsPage

Визуал:

```
┌──────────────────────────────────────────────────────┐
│  Настройки LLM                                        │
│────────────────────────────────────────────────────────│
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ GLM (Z.ai)                          [★ По умолч.] │  │
│  │ Модель: GLM-4.6V                                  │  │
│  │ API Key: ●●●●●●●●                   [Тест] [✎] [🗑]│  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ OpenAI                                            │  │
│  │ Модель: GPT-4o                                    │  │
│  │ API Key: ●●●●●●●●                   [Тест] [✎] [🗑]│  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  [+ Добавить провайдер]                                │
│                                                        │
│  ── Промпт генерации ──                               │
│  Системный промпт: [___________________________]       │
│  Тон: [Дружелюбный ▼]                                 │
│                                                        │
└──────────────────────────────────────────────────────┘
```

> Системный промпт и тон — глобальные (хранятся в дефолтном провайдере или отдельно).
> При клике [Тест] — `POST /api/llm-settings/test` с текстовым промптом (без изображения).

### 3.4 Router + MainLayout

```typescript
// Новый роут
{ path: '/settings/llm', component: LlmSettingsPage, meta: { auth: true, role: 'admin' } }
```

Навигация — между «Поиск» и «Пользователи»:
```
Аккаунты       /accounts         всем
Лента           /feed             всем
Поиск           /search           всем
Настройки LLM   /settings/llm     admin   ← ФАЗА 4
Пользователи    /admin/users      admin
```

### Тестирование шага 3

1. Открыть `/settings/llm` под admin-пользователем
2. Добавить GLM провайдер (API key, модель, тон)
3. Нажать «Тест» — убедиться что запрос доходит до backend
4. Установить провайдер по умолчанию
5. Проверить что данные сохраняются после перезагрузки страницы

---

## Шаг 4 — LLM Service: генерация комментария (Backend)

**Цель:** сервис, который по URL изображения + промпту генерирует комментарий через GLM/OpenAI API.

> Связь с планом: [PLAN.md](PLAN.md) п. 4.3
> API документация: [vision-api-guide.md](vision-api-guide.md)

### Новые файлы

```
backend-laravel/app/Services/
├── LlmServiceInterface.php
└── LlmService.php
```

### 4.1 LlmServiceInterface

```php
interface LlmServiceInterface {
    /**
     * Сгенерировать комментарий к Instagram-посту.
     *
     * @param string $imageUrl   URL изображения поста
     * @param string|null $captionText  Текст описания поста (для контекста)
     * @return string  Сгенерированный комментарий
     */
    public function generateComment(string $imageUrl, ?string $captionText = null): string;

    /**
     * Тест подключения к LLM API (простой текстовый промпт).
     */
    public function testConnection(string $provider, string $apiKey, string $modelName): bool;
}
```

### 4.2 LlmService — реализация

**Алгоритм `generateComment`:**

1. Получить дефолтный `LlmSetting` из БД
2. Скачать изображение по URL → base64
3. Собрать messages:
   - `system`: системный промпт + тон (из настроек)
   - `user`: `[image_url (base64), text (caption + инструкция)]`
4. Отправить запрос к API провайдера:
   - GLM: `POST https://api.z.ai/api/paas/v4/chat/completions` ([vision-api-guide.md:26](vision-api-guide.md#L26))
   - OpenAI: `POST https://api.openai.com/v1/chat/completions` ([vision-api-guide.md:214](vision-api-guide.md#L214))
5. Извлечь `choices[0].message.content`
6. Return текст комментария

**Системный промпт по умолчанию:**

```
Ты — помощник для Instagram. Твоя задача — написать короткий, живой,
естественный комментарий к посту на основе изображения и описания.

Правила:
- Комментарий должен быть на языке описания поста (или на английском, если описания нет)
- Длина: 1-3 предложения
- Без хэштегов, без эмодзи-спама
- Выглядеть как реальный комментарий от живого человека
- Не повторять описание поста дословно
```

**Различия провайдеров (по [vision-api-guide.md](vision-api-guide.md)):**

| Параметр | GLM (Z.ai) | OpenAI |
|----------|-----------|--------|
| Endpoint | `api.z.ai/api/paas/v4/chat/completions` | `api.openai.com/v1/chat/completions` |
| Заголовок | `Authorization: Bearer KEY` | `Authorization: Bearer KEY` |
| Формат image | `image_url.url` (URL или base64) | `image_url.url` + `detail` |
| Специфичное | `thinking: { type: "disabled" }` | `max_tokens: 512` |

### 4.3 DI binding

```php
// AppServiceProvider::register()
$this->app->singleton(LlmServiceInterface::class, LlmService::class);
```

### Тестирование шага 4

```bash
# Через Tinker (DEBUG_PROTOCOL.md шаг 3)
docker compose exec -T laravel php artisan tinker <<'TINKER'
$service = app(\App\Services\LlmServiceInterface::class);

// Тест подключения
$ok = $service->testConnection('glm', 'YOUR_REAL_KEY', 'glm-4.6v-flash');
echo "Connection: " . ($ok ? 'OK' : 'FAIL') . "\n";

// Тест генерации (любой публичный URL картинки)
$comment = $service->generateComment(
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/320px-Camponotus_flavomarginatus_ant.jpg',
    'Amazing macro photography of an ant'
);
echo "Comment: " . $comment . "\n";
TINKER
```

> Для первого тестирования использовать `glm-4.6v-flash` — бесплатный тариф ([vision-api-guide.md:15](vision-api-guide.md#L15)).

---

## Шаг 5 — Job + Event + Controller: генерация через очередь с broadcast

**Цель:** генерация комментария выполняется в фоне (job), статус транслируется через WebSocket.

> Связь с планом: [PLAN.md](PLAN.md) п. 4.4, 4.5, 4.6

### Новые файлы

```
backend-laravel/app/
├── Events/
│   └── CommentGenerationProgress.php
├── Jobs/
│   └── GenerateCommentJob.php
├── Http/Controllers/
│   └── CommentGenerateController.php
```

### 5.1 CommentGenerationProgress event

```php
class CommentGenerationProgress implements ShouldBroadcast {
    public function __construct(
        public string $jobId,
        public string $step,      // 'downloading', 'analyzing', 'completed', 'failed'
        public ?string $comment = null,
        public ?string $error = null,
    ) {}

    public function broadcastOn(): Channel {
        return new PrivateChannel("comment-generation.{$this->jobId}");
    }

    public function broadcastWith(): array {
        return [
            'job_id'  => $this->jobId,
            'step'    => $this->step,
            'comment' => $this->comment,
            'error'   => $this->error
        ];
    }
}
```

### 5.2 channels.php — авторизация канала

```php
Broadcast::channel('comment-generation.{jobId}', function ($user, $jobId) {
    // Любой авторизованный пользователь может слушать свой job
    return $user !== null;
});
```

### 5.3 GenerateCommentJob

```php
class GenerateCommentJob implements ShouldQueue {
    use Queueable;

    public int $tries = 1;
    public int $timeout = 60;

    public function __construct(
        public string $jobId,
        public string $imageUrl,
        public ?string $captionText,
    ) {}

    public function handle(LlmServiceInterface $llmService): void {
        try {
            // Шаг 1: скачивание
            broadcast(new CommentGenerationProgress($this->jobId, 'downloading'));

            // Шаг 2: анализ (LLM)
            broadcast(new CommentGenerationProgress($this->jobId, 'analyzing'));
            $comment = $llmService->generateComment($this->imageUrl, $this->captionText);

            // Шаг 3: готово
            broadcast(new CommentGenerationProgress($this->jobId, 'completed', comment: $comment));

        } catch (\Exception $e) {
            broadcast(new CommentGenerationProgress($this->jobId, 'failed', error: $e->getMessage()));
            throw $e;
        }
    }
}
```

> Скачивание изображения происходит внутри `LlmService::generateComment()`, но broadcast шагов — в job.

### 5.4 CommentGenerateController

```php
final class CommentGenerateController extends Controller {
    public function generate(Request $request): JsonResponse {
        $request->validate([
            'image_url'    => 'required|url',
            'caption_text' => 'nullable|string|max:2000'
        ]);

        $jobId = (string) Str::uuid();

        GenerateCommentJob::dispatch(
            $jobId,
            $request->input('image_url'),
            $request->input('caption_text'),
        );

        return response()->json([
            'success' => true,
            'data'    => ['job_id' => $jobId],
            'message' => 'Generation started'
        ]);
    }
}
```

### 5.5 Route

```php
// В authenticated + active group
Route::post('/comments/generate', [CommentGenerateController::class, 'generate']);
```

### Тестирование шага 5

**Терминал 1 — мониторинг WebSocket:**
```bash
# Подключиться к приватному каналу через wscat или WebSocket-клиент
# Или через логи Reverb:
docker compose logs -f reverb
```

**Терминал 2 — мониторинг queue-worker:**
```bash
docker compose logs -f queue-worker
```

**Терминал 3 — отправить запрос:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@insta-pilot.local","password":"password"}' | jq -r '.data.token')

curl -s -X POST http://localhost:8000/api/comments/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/320px-Camponotus_flavomarginatus_ant.jpg",
    "caption_text": "Amazing macro photography"
  }' | jq .
```

**Ожидаемый результат:**
```json
{ "success": true, "data": { "job_id": "550e8400-e29b-41d4-a716-446655440000" } }
```

В логах queue-worker — обработка job. В логах reverb — broadcast 3 событий (downloading → analyzing → completed).

---

## Шаг 6 — Frontend: WebSocket + генерация комментария в UI

**Цель:** полный flow в браузере: кнопка → статусы → комментарий вставлен в поле.

> Связь с планом: [PLAN.md](PLAN.md) п. 4.11–4.14
> Точка интеграции: [PostDetailModal.vue](frontend-vue/src/features/post-detail/ui/PostDetailModal.vue)

### 6.1 Установить npm пакеты

```bash
docker compose exec vue npm install laravel-echo pusher-js
```

### 6.2 Новые файлы

```
frontend-vue/src/
├── shared/
│   └── lib/
│       └── echo.ts                    # Laravel Echo инициализация
├── features/
│   └── generate-comment/
│       ├── lib/
│       │   └── useCommentGeneration.ts  # composable: API + WebSocket
│       ├── ui/
│       │   └── GenerationStatus.vue     # визуальный статус (QTimeline)
│       └── index.ts
```

### 6.3 shared/lib/echo.ts

```typescript
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

window.Pusher = Pusher

export const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST,
  wsPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
  forceTLS: false,
  enabledTransports: ['ws'],
  authEndpoint: `${import.meta.env.VITE_API_URL}broadcasting/auth`,
  auth: {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }
})
```

**Frontend `.env`:**
```env
VITE_REVERB_APP_KEY=insta-pilot-key
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
```

### 6.4 useCommentGeneration composable

```typescript
type GenerationStep = 'idle' | 'starting' | 'downloading' | 'analyzing' | 'completed' | 'failed'

export function useCommentGeneration() {
  const step = ref<GenerationStep>('idle')
  const generatedComment = ref<Nullable<string>>(null)
  const error = ref<Nullable<string>>(null)
  const loading = ref(false)

  const generate = async (imageUrl: string, captionText?: string) => {
    step.value = 'starting'
    loading.value = true
    generatedComment.value = null
    error.value = null

    // 1. POST /api/comments/generate → получить job_id
    const { data } = await api.post('/comments/generate', { image_url: imageUrl, caption_text: captionText })
    const jobId = data.data.job_id

    // 2. Подписаться на WebSocket канал
    echo.private(`comment-generation.${jobId}`)
      .listen('CommentGenerationProgress', (event) => {
        step.value = event.step
        if (event.step === 'completed') {
          generatedComment.value = event.comment
          loading.value = false
          echo.leave(`comment-generation.${jobId}`)
        }
        if (event.step === 'failed') {
          error.value = event.error
          loading.value = false
          echo.leave(`comment-generation.${jobId}`)
        }
      })
  }

  const reset = () => {
    step.value = 'idle'
    generatedComment.value = null
    error.value = null
    loading.value = false
  }

  return { step, generatedComment, error, loading, generate, reset }
}
```

### 6.5 GenerationStatus.vue

QTimeline с шагами:

```
● Запуск генерации...          (starting)
● Загрузка изображения...      (downloading)
● Анализ изображения (LLM)...  (analyzing)
● Комментарий готов!            (completed)
✕ Ошибка: ...                  (failed)
```

### 6.6 Интеграция в PostDetailModal

1. Убрать `disable` с кнопки «Сгенерировать»
2. При клике → `generate(post.thumbnailUrl, post.captionText)`
3. Показать `GenerationStatus` под кнопкой
4. При `completed` → `commentText.value = generatedComment.value`

### 6.7 Frontend `.env` — добавить переменные Reverb

```env
VITE_REVERB_APP_KEY=insta-pilot-key
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
```

### Тестирование шага 6

1. Открыть `/search`, найти пост
2. Кликнуть на пост → открывается PostDetailModal
3. Нажать «Сгенерировать»
4. Увидеть статусы: starting → downloading → analyzing → completed
5. Комментарий автоматически вставлен в поле ввода
6. Нажать «Отправить» — комментарий отправляется (существующий функционал)

**Параллельно — мониторинг в консоли:**
```bash
# WebSocket события
docker compose logs -f reverb

# Queue обработка
docker compose logs -f queue-worker
```

---

## Порядок реализации (сводка)

| # | Шаг | Слой | Зависимости | Результат тестирования |
|---|-----|------|-------------|----------------------|
| 1 | Инфраструктура | DevOps | — | WebSocket подключается, queue-worker запущен |
| 2 | LLM Settings backend | Laravel | Шаг 1 (миграция) | CRUD через cURL, данные в БД |
| 3 | LLM Settings frontend | Vue | Шаг 2 (API) | Страница настроек работает, данные сохраняются |
| 4 | LLM Service | Laravel | Шаг 2 (модель) | Генерация комментария через Tinker |
| 5 | Job + Event + Controller | Laravel | Шаги 1, 4 | Job обрабатывается, broadcast виден в логах |
| 6 | Frontend генерация | Vue | Шаги 1, 5 | Полный flow в браузере |

---

## Модели и провайдеры

Из [vision-api-guide.md](vision-api-guide.md):

### GLM (Z.ai)

| Модель | Назначение | Цена |
|--------|-----------|------|
| `glm-4.6v` | Flagship, 128K контекст | Платный |
| `glm-4.6v-flashx` | Быстрый | Платный |
| `glm-4.6v-flash` | Бесплатный, 9B параметров | **Бесплатно** |

### OpenAI

| Модель | Назначение | Цена |
|--------|-----------|------|
| `gpt-4o` | Flagship, 128K | Платный |
| `gpt-4o-mini` | Дешевле, быстрее | Дешёвый |
| `gpt-4.1` | 1M контекст | Платный |
| `gpt-4.1-mini` | Облегчённый | Дешёвый |

> Для разработки и тестирования использовать `glm-4.6v-flash` (бесплатный).

---

## Заметки

- **WebSocket мониторинг** — в Фазе 4 real-time статусы отображаются только в PostDetailModal и в консоли (docker logs). Полноценный UI мониторинга (таблицы, фильтры) — Фаза 5.
- **Proxy для изображений** — Instagram изображения требуют проксирования. `ProxyImageController` уже реализован — использовать `proxyImageUrl()` для URL при отправке в LLM.
- **Error handling** — если LLM API недоступен или ключ невалиден, job возвращает `failed` с сообщением об ошибке. На фронтенде — красный статус + текст ошибки.
- **channels.php** — после `install:broadcasting` файл создастся автоматически. Нужно добавить только канал `comment-generation.{jobId}`.
- **Queue driver** — переключить на `redis` (уже в docker-compose). Database driver медленнее.
- **Frontend auth для Echo** — токен берётся из `localStorage` (как в axios interceptor, см. [axios.ts](frontend-vue/src/boot/axios.ts)).
