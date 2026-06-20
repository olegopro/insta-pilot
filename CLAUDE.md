# insta-pilot — Project Memory

## Project Overview
Instagram auto-liker web service.
Stack: Laravel 13 (backend) + Python FastAPI + instagrapi (Instagram layer) + Vue 3 + Quasar (frontend).
DB: PostgreSQL 16. Queue: Redis.

## Project Structure
```
insta-pilot/
├── backend-laravel/    # Laravel 13, PHP 8.3
├── frontend-vue/       # Vue 3 + Quasar + TypeScript
├── python-service/     # FastAPI + instagrapi
├── docker/             # Dockerfiles (laravel/, python/, vue/)
└── docker-compose.yml
```

## Docker Services
- `vue`          → port 9000 (Vite dev server)
- `laravel`      → port 8000 (PHP-FPM + Artisan serve)
- `python`       → port 8001 (FastAPI + instagrapi)
- `postgres`     → port 5432 (PostgreSQL 16)
- `redis`        → port 6379 (Queue + Broadcasting)
- `reverb`       → port 8080 (WebSocket сервер, Laravel Reverb)
- `queue-worker` → Redis queue worker (обработка Jobs)

## Environment
Root `.env`: `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `INSTAGRAM_SALT`
Frontend `.env`: `VITE_API_URL=http://localhost:8000/api/`
Laravel: `INSTAGRAM_PYTHON_URL=http://python:8001` (внутренний Docker URL)

## Data Flow
```
[Vue SPA] → [Laravel API] → [Python FastAPI] → [Instagram (instagrapi)]
                ↓
          [Redis Queue]
                ↓
          [GenerateCommentJob] → [LLM API (GLM / OpenAI)]
                ↓
          [Laravel Reverb] ←→ [Frontend (Echo + pusher-js)]
```

## Python service — instagrapi
Документация: https://subzeroid.github.io/instagrapi/
Context7 library ID: `/subzeroid/instagrapi`
Версия: `instagrapi==2.10.6` (требует Python ≥3.10; Docker-образ `python:3.12-slim`). Локальный `venv` (3.9) для запуска не подходит — тесты гонять в контейнере. Пакеты держим на последних версиях (`requirements.txt` / `requirements-dev.txt`).

### Пагинация ленты (timeline feed) — РУЧНАЯ, не штатная
Пагинация идёт через РУЧНОЙ `cl.private_request("feed/timeline/", data=_build_pagination_params(...), with_signature=False)` — тело передаётся как **dict (form-поля)**: `max_id` + `seen_posts` (csv виденных) + `feed_view_info` (`_build_view_info`) + поля устройства.

ВАЖНО: штатный `cl.get_timeline_feed(max_id, seen_posts)` (instagrapi ≥2.10.5, PR #2497 для бага #1789) для ленты НЕ годится — он шлёт тело как `json.dumps` (строка), и Instagram `feed/timeline/` так почти не пагинируется. Замер на одном аккаунте: ручной способ дал 14 уникальных постов за 6 страниц, штатный — 4. Поэтому ленту оставляем на ручной реализации, апгрейд instagrapi её не меняет.

`_paginate_feed` дедуплицирует батч по уже собранным id (ранжированная лента может повторять посты). Старый снимок ленты — git-тег `feed-manual-pagination-v1`. Будущее (отдельный этап): рассмотреть забор ленты через headless-браузер или Android-эмулятор — private API даёт ограниченную/повторяющуюся домашнюю ленту.

### Правила работы (по проекту)
- Основной клиент: `instagrapi.Client` внутри `python-service` слоя, без прямых вызовов из Laravel/Vue.
- Любые сетевые/Instagram-ошибки оборачивать в предсказуемый API-ответ FastAPI (без traceback наружу).
- Сессии хранить и переиспользовать через `session_data` (JSON), чтобы снижать количество логинов.
- Перед логином загружать существующую сессию; после успешной авторизации сохранять обновлённые настройки клиента.
- Прокси задавать на клиенте до авторизации; формат и валидность прокси проверять заранее.
- Не логировать пароль, cookie, full session dump и другие чувствительные данные.
- Таймауты/ретраи делать ограниченными и аккуратными, чтобы не провоцировать антибот-защиту.
- Не использовать массовые/агрессивные действия без явной бизнес-необходимости (rate-limit first).
- В Instagram API суффикс `_pk` — всегда числовой ID сущности (`user_pk`, `location_pk`, `media_pk`), суффикс `_id` — составной (`media_id` = `{media_pk}_{user_pk}`); использовать тот суффикс, который принимает конкретный метод instagrapi.

## User Preferences
- Answer in Russian
- User writes code themselves — give hints, not full implementations
- No implementation without explicit request — plan first

## Делегирование субагентам — приоритет по умолчанию
При работе в ЭТОМ репозитории главная модель по умолчанию — ОРКЕСТРАТОР, а не единственный
исполнитель. На старте каждого чата держать в уме: рядом всегда есть пул внешних агентов (VibeProxy
с несколькими моделями Kiro + Codex через MCP). Как только задача больше тривиальной — затрагивает
**>1 файла**, требует широкого чтения/анализа, ресёрча, второго мнения или объёмной правки — в ПЕРВУЮ
очередь рассматривать делегирование соседним MCP, а не прогон всего через свой контекст.

Это не отменяет правила выше: «hints, not implementations» и «plan first» решают, ЧТО показать
пользователю и когда вообще начинать кодить; делегирование — это КАК выполнять работу, когда она уже
санкционирована. Делегированный результат пользователю всё равно подаётся как разобранный diff/итог,
а не как «накодил за тебя».

Каналы (дёргать проактивно, а не в последнюю очередь):
- **VibeProxy / `vibe-agent`** (`:8318`, модели Kiro) — основной канал для работы с кодом репозитория.
  - `mcp__vibe-agent__delegate_edit(task, workdir, model)` — правки кода: агент сам читает/правит
    файлы и возвращает итог + `git diff --stat`. Главная модель даёт самодостаточную задачу и сверяет diff.
  - `mcp__vibe-agent__ask(prompt, model)` — второе мнение / разбор / черновик без файлов.
- **Codex через MCP** (`mcp__codex__codex`) — независимое второе мнение, глубокий анализ/ресёрч,
  чтение реального репозитория. Поле `config` (service_tier/effort) — по правилу глобального CLAUDE.md.

Приоритет моделей VibeProxy (цена Opus НЕ является ограничением):
1. **`kiro-claude-opus-4-8`** — по умолчанию. Рабочая гипотеза: Opus 4.8 даже без reasoning, как
   правило, сильнее Sonnet 4.6 с reasoning. Балансировать с Sonnet по объёму/связности задачи.
2. **`kiro-claude-sonnet-4-6`** — когда Opus избыточен (рутинная широкая правка; единственная модель
   Kiro, отдающая reasoning).
3. **`kiro-glm-5`** — только узкие дешёвые задачи (на большом контексте плывёт, раздувает токены).

Что НЕ делегировать: тривиальные однофайловые правки, разговорные ответы, то что быстрее и надёжнее
сделать самому. Несколько независимых кусков — несколько агентов разом; но помнить про per-account
spacing Kiro (на одном аккаунте вызовы сериализуются — реального параллелизма нет).

Главная модель отвечает за итог: каждый делегированный diff/ответ ВЕРИФИЦИРОВАТЬ (черновики чужих
моделей не принимать на веру), держать когерентность по CLAUDE.md, сводить результат. Детальный
плейбук параллельного fan-out — `ORCHESTRATION.md` и `AGENT-FACTORY.md`.

---

# Блок «Автоматизация/Бот» (в разработке)

Парсер целей (хэштег/гео + комбо-фильтры аккаунта и контента) + переиспользуемый движок действий
(комментарий — MVP; лайк/подписка/отписка — позже) с распределением во времени, дневными лимитами и
рабочими часами на аккаунт. Два режима: полу-ручной (парсинг → корзина → старт) и полностью авто.

Источник истины по архитектуре — проектные документы в корне:
- `AUTOMATION-ARCHITECTURE.md` — все слои, 9 таблиц, контракты, разрешённые конфликты, дефолты.
- `AUTOMATION-PLAN.md` — поэтапный план (Phase 0 → MVP «комментарии хэштег/гео полу-ручной» → …).
- `ORCHESTRATION-RETROSPECTIVE.md` — ретро мультиагентных прогонов (аналитика для настройки VibeProxy).

Канонические решения (НЕ нарушать при доработке): учёт дневных лимитов — таблица-счётчик
`account_action_counters` + `SELECT … FOR UPDATE` (НЕ COUNT по логам); распределение — БД-строки
`automation_action_items.run_at` + диспетчер `schedule()->everyMinute()` (НЕ delay()-jobs);
идемпотентность — UNIQUE(`instagram_account_id`,`action_type`,`media_pk`) + CAS-claim + reconcile;
единый TZ на аккаунт (`account_working_hours.timezone`) для окна и границы суток лимита; методы
`InstagramClientService` — auth-context-free (явный `?int $userId`).

Статус сборки: **Wave 1 (фундамент) готов** — 9 таблиц (`parse_filter_presets`, `parse_runs`,
`parsed_targets`, `automation_tasks`, `automation_action_items`, `account_action_limits`,
`account_action_counters`, `account_working_hours`, `account_target_interactions`) + модели +
репозитории; Phase 0 инфра (контейнеры `scheduler` и `automation-worker`, очередь `automation`,
auth-context-free `InstagramClientService`). Дальше: Wave 2 — логика парсинга/движка (Python +
Laravel); Wave 3 — фронтенд (FSD-слайсы). TODO Phase 1D: `retry_after` очереди `automation` >
timeout `ExecuteActionItemJob` (сейчас дефолт `90==90`).

---

# Backend — Laravel 13

## Документация
- Laravel 12: Context7 library ID: `/websites/laravel_12_x`
- Laravel (общая): Context7 library ID: `/laravel/docs`

## Правила
- `declare(strict_types=1)` в каждом PHP файле
- Controllers: `final class`, только `JsonResponse` в return
- DI через конструктор, `private readonly`
- Паттерн: Interface → Implementation → bind в AppServiceProvider → (опционально) Facade
- Фигурная скобка `{` на той же строке: `class Foo {`, `function bar(): void {`, `interface Baz {`
- Trailing comma в массивах не ставится: `['a', 'b', 'c']`, не `['a', 'b', 'c',]`
- Массивы с 2+ элементами — многострочно, каждый элемент на своей строке

## Структура app/
```
Http/Controllers/             # final class, readonly DI, JsonResponse
Http/Middleware/               # EnsureUserIsActive и другие
Models/                       # Eloquent, шифрование через Accessors
Models/Concerns/              # Trait-ы моделей (HasEncryption)
Providers/AppServiceProvider  # все bindings в register()
Repositories/                 # Interface + Implementation
Services/                     # Interface + Implementation
Jobs/                         # Queue jobs (GenerateCommentJob)
Events/                       # Broadcasting events
Facades/                      # extends Facade → aliases в config/app.php
Console/                      # Artisan commands
```

## API Response Format
```php
// Успех
return response()->json(['success' => true, 'data' => $data, 'message' => 'OK']);
// Ошибка
return response()->json(['success' => false, 'error' => 'Описание'], 500);
```

## Таблица instagram_accounts
| Поле                    | Тип                   | Описание                |
|-------------------------|-----------------------|-------------------------|
| id                      | bigIncrements         | PK                      |
| user_id                 | FK, nullable          | владелец (users), nullOnDelete |
| instagram_login         | string, unique        | логин                   |
| instagram_password      | text                  | зашифрован              |
| session_data            | text, nullable        | JSON сессии, зашифрован |
| proxy                   | string, nullable      | прокси                  |
| full_name               | string, nullable      | имя из Instagram        |
| profile_pic_url         | text, nullable        | URL аватарки            |
| device_profile_id       | FK, nullable          | профиль устройства (device_profiles), nullOnDelete |
| device_model_name       | string, nullable      | модель устройства аккаунта |
| is_active               | boolean, default true |                         |
| last_used_at            | timestamp, nullable   |                         |
| created_at / updated_at | timestamps            |                         |

Шифрование через Accessors в модели с `INSTAGRAM_SALT` → `config('app.instagram_salt')`.

## Таблица device_profiles
| Поле         | Тип            | Описание                            |
|--------------|----------------|-------------------------------------|
| id           | bigIncrements  | PK                                  |
| code         | string, unique | код профиля                         |
| title        | string         | название профиля                    |
| device_settings | json        | UUID и параметры устройства (Android) |
| user_agent   | text           | User-Agent строка                   |
| is_active    | boolean, default true |                              |
| created_at / updated_at | timestamps |                            |

Данные хранятся в `backend-laravel/data/device-profiles/device-profiles.json`. Заполняются через `DeviceProfileSeeder`. Назначается аккаунту при добавлении (`device_profile_id`) — передаётся в Python как заголовки запросов.

## Таблица account_activity_logs
| Поле              | Тип               | Описание                                 |
|-------------------|-------------------|------------------------------------------|
| id                | bigIncrements     | PK                                       |
| instagram_account_id | FK             | аккаунт (cascadeOnDelete)                |
| user_id           | FK                | пользователь-владелец (cascadeOnDelete)  |
| action            | string            | тип действия (login, like, comment, ...) |
| status            | string            | success / fail                           |
| http_code         | smallInteger, nullable | HTTP-код ответа                     |
| endpoint          | string, nullable  | вызванный endpoint                       |
| request_payload   | json, nullable    | payload запроса (cast array, sanitized)  |
| response_summary  | json, nullable    | сводка ответа (cast array)               |
| error_message     | text, nullable    | текст ошибки                             |
| error_code        | string, nullable  | код ошибки                               |
| duration_ms       | integer, nullable | время выполнения запроса                 |
| created_at        | timestamp, useCurrent | без updated_at (`$timestamps=false`) |

Логирование через `ActivityLoggerService` / `ActivityLoggerServiceInterface`. Репозиторий: `ActivityLogRepository`. Broadcasting event: `ActivityLogCreated` (каналы `private:account-activity.{accountId}` и `private:activity-global.{userId}`).

## Таблица llm_settings
| Поле          | Тип                   | Описание                        |
|---------------|-----------------------|---------------------------------|
| id            | bigIncrements         | PK                              |
| provider      | string                | glm / openai                    |
| api_key       | text                  | зашифрован (hidden по умолчанию)|
| model_name    | string                | имя модели LLM                  |
| system_prompt | text, nullable        | системный промпт                |
| tone          | string, nullable      | friendly/professional/casual/humorous |
| use_caption   | boolean, default true | передавать ли описание поста в LLM |
| is_default    | boolean, default false| провайдер по умолчанию          |

## WebSocket (Laravel Reverb)
- Broadcasting через Laravel Echo + pusher-js
- Frontend: `echo` instance в `shared/lib/echo.ts`

| Канал | Event | Назначение |
|-------|-------|-----------|
| `private:comment-generation.{jobId}` | `CommentGenerationProgress` | прогресс генерации (starting → downloading → analyzing → completed/failed) |
| `private:account-activity.{accountId}` | `ActivityLogCreated` | новая запись лога аккаунта в реальном времени |
| `private:activity-global.{userId}` | `ActivityLogCreated` | глобальный поток логов пользователя (admin) |

---

# Frontend — Vue 3 + Quasar + TypeScript

## Документация
- Vue 3: Context7 library ID: `/vuejs/docs`
- Quasar: Context7 library ID: `/quasarframework/quasar`
- FSD: Context7 library ID: `/feature-sliced/documentation`

## Архитектура: FSD (Feature-Sliced Design)
Документация: https://feature-sliced.design/docs

## Правила
- Порядок блоков SFC: `<script setup lang="ts">` → `<template>` → `<style>`
- Импорты: через `@/` (не `./` или `../`)
- Обработчики событий: суффикс `Handler` (`submitHandler`)
- UI компоненты: только кастомные обёртки из `shared/ui/` (ButtonComponent, InputComponent, SelectComponent, ToggleComponent, ...) над Quasar, суффикс `Component`
- Каждый action в store — через `useApi`, никакого внутреннего state в store
- Public API слайсов — через `index.ts` в каждом сегменте
- Стиль кода: стрелочные функции без `{}` если тело — один expression (`.catch(() => Notify.create(...))`); enforced ESLint-правилом `local/arrow-concise-body` с autofix
- Стиль кода: параметры callback-ов — только полные имена, без однобуквенных сокращений (`.then((response) => response.data)`, `.find((account) => account.id === id)`, не `r`, `a`, `e` и т.п.)`
- Стиль кода: `&&` вместо `if` для коротких условных вызовов (`opened && fn()`)
- Стиль кода: хуки жизненного цикла (`onMounted`, `onBeforeUnmount` и др.) размещать в самом конце `<script setup>`, после всех переменных, computed и watch — ESLint это не проверяет, соглашение проекта
- Шаблоны: никогда не добавлять `.value` — Vue автоматически разворачивает `Ref` в `<template>`
- Уведомления: использовать `notifyError` / `notifySuccess` из `@/shared/lib`, а не `Notify.create` напрямую
- Trailing comma в объектах не ставится: `{ a: 1, b: 2 }`, не `{ a: 1, b: 2, }`; правило распространяется и на объект с одним свойством: `{ a: 1 }`, не `{ a: 1, }`
- Валидация форм: правила выносить в переменные в `<script setup>`, не писать функции прямо в `:rules`; все переиспользуемые валидаторы — в `shared/lib/validators.ts` (реэкспорт через `shared/lib/index.ts`); для email использовать `patterns.testPattern.email` из `quasar`, не `type="email"`

## Обёртки над Quasar-компонентами (shared/ui)

Паттерн каждого wrapper-компонента (`shared/ui/*/`):
- `interface XxxComponentProps extends Omit<QXxxProps, 'modelValue'>` + `defineProps<XxxComponentProps>()`
- `useForwardProps(props)` из `@/shared/lib` — фильтрует `undefined` для корректного проброса пропсов
- `defineOptions({ inheritAttrs: false })` + `v-bind="{ ...$attrs, ...forwarded }"` на корневом элементе
- `defineModel` для двустороннего бинда
- Слоты: proxy через `v-for` по `$slots`
- `export interface XxxComponentProps` + реэкспорт через `index.ts` сегмента
- Компоненты с required-пропсами (QTable, QTree и др.) — нужен cast: `v-bind="{ ...$attrs, ...(forwarded as QXxxProps) }"` (см. JSDoc в `useForwardProps.ts`)

Примеры: `shared/ui/input-component/` (без cast), `shared/ui/table-component/` (с cast)

## Типы и DTO
- API типы (snake_case от бэкенда): суффикс `Api` — `MediaPostApi`, `FeedResponseApi`. Файл: `apiTypes.ts`
- Локальные типы (camelCase): без суффикса — `MediaPost`, `InstagramUserDetail`. Файл: `types.ts`
- DTO: класс-синглтон с `toLocal()` / `toLocalPost()`. Файл: `*DTO.ts`, экспорт: `export default new ClassName()`
- `Nullable<T>` из `@/shared/lib` вместо `T | null`

## Паттерн таблиц (QTable)
Всегда использовать `TableComponent` из `@/shared/ui/table-component` вместо `q-table` напрямую.
Для каждой сущности с таблицей создавать два файла в `entities/*/model/`:
- `*TableColumns.ts` — колонки + `RowModel` интерфейс (`satisfies QTableColumn<RowModel>[]`)
- `*ListDTO.ts` — маппинг API-модели (snake_case) → RowModel (camelCase), класс + singleton

Страница/виджет с таблицей использует:
```ts
const { columns, columnsVisibleNames } = useFilterColumns(*TableColumns)
const { searchText } = useSearchQuery()
const rows = computed(() => *ListDTO.toLocal(store.someApi.data?.data ?? []))
```
Пример: [InstagramAccountsList.vue](src/widgets/instagram-accounts-list/ui/InstagramAccountsList.vue)

## Структура src/ (FSD)
```
boot/                    # Quasar boot (не трогать расположение)
  axios.ts               # axios instance + globalProperties
router/                  # Quasar router (не трогать расположение)
  index.ts               # createRouter + Router.beforeEach(authGuard)
  guard.ts               # authGuard — навигационный guard (вынесен из index.ts ради unit-тестов)
layouts/                 # MainLayout

shared/
  api/                   # useApi, ApiResponseWrapper
  lib/                   # Nullable, notify, formatters, echo, useModal, useFilterColumns,
                         # useSearchQuery, useForwardProps, validators, proxyImageUrl,
                         # useReverseInfiniteScroll
  ui/
    button-component/    # каждый компонент — своя папка (kebab-case) + index.ts
    input-component/
    modal-component/
    select-component/
    toggle-component/
    table-component/
    table-tools-wrapper/
    masonry-grid/        # CSS columns Masonry
    media-card/          # Карточка поста (thumbnail + overlay)
    media-display/       # Фото/видео/карусель (Swiper.js)

entities/
  instagram-account/     # InstagramAccount, accountStore, ProfileCard
  media-post/            # MediaPost, feedStore, searchStore, MEDIA_TYPE constants
  llm-settings/          # LlmSetting, llmSettingsStore, LLM_PROVIDERS/MODELS constants
  user/                  # User, authStore, token management
  activity-log/          # AccountActivityLog, activityLogStore, sidebarActivityStore,
                         # activityLogTableColumns, activitySummaryTableColumns,
                         # activityLogListDTO, activitySummaryListDTO, apiTypes, types, constants

features/
  add-instagram-account/ # Добавление аккаунта
  delete-instagram-account/
  view-instagram-account/
  auth-login/            # Форма логина
  post-detail/           # PostDetailModal (фото/видео, комментарии, лайки)
  instagram-user/        # InstagramUserModal (профиль пользователя)
  generate-comment/      # useCommentGeneration (WebSocket), GenerationStatus
  activity-filter/       # Фильтрация логов (аккаунт, действие, статус, дата)
  activity-live/         # WebSocket-подписка на ActivityLogCreated

widgets/
  instagram-accounts-list/  # Таблица аккаунтов
  activity-log-table/       # Таблица логов (с разворотом строки, reverse-scroll)
  activity-sidebar/         # Боковая панель с деталями записи лога
  activity-stats-cards/     # Карточки сводной статистики
  activity-summary-table/   # Таблица сводки по действиям
  activity-grouped-stats/   # Сгруппированная статистика

pages/
  login/                 # LoginPage
  instagram-accounts/    # InstagramAccountsPage
  feed/                  # FeedPage (Masonry-лента)
  search/                # SearchPage (хэштеги/гео + комментарии)
  llm-settings/          # LlmSettingsPage (admin)
  admin-users/           # AdminUsersPage (admin)
  logs/                  # LogsPage (мониторинг активности, Phase 5)
```

## Нейминг
- `instagram-account` — Instagram аккаунт в системе
- `user` — пользователь системы insta-pilot (Sanctum auth + Spatie roles: admin/user)
- `media-post` — публикация Instagram (фото/видео/карусель)
- `llm-settings` — настройки LLM-провайдера (GLM / OpenAI)
- `activity-log` — запись лога активности аккаунта (`account_activity_logs`)
- `device-profile` — профиль устройства Android для инстаграм-клиента

## Pinia и .value
- В компоненте через `store.someProperty`: `.value` НЕ нужно — Pinia применяет `UnwrapRef` рекурсивно
- Правило: `store.*.value` в компоненте — это ошибка TS

## Паттерн store: нейминг и структура
```ts
// ПРИВАТНЫЕ useApi-объекты (суффикс Api, не в return):
const fetchAccountsApi = useApi(...)
const deleteAccountApi = useApi(...)

// ПУБЛИЧНЫЕ ref-данные (существительное):
const accounts = ref<InstagramAccount[]>([])

// ПУБЛИЧНЫЕ actions — всегда императивный паттерн:
const fetchAccounts = async () => {
  const { data } = await fetchAccountsApi.execute()
  accounts.value = data
}
const fetchAccountsLoading = computed(() => fetchAccountsApi.loading.value)

// Если action не работает с данными ответа — fire-and-forget:
const deleteAccount = (id: number) => deleteAccountApi.execute(id)
const deleteAccountLoading = computed(() => deleteAccountApi.loading.value)
const deleteAccountError = computed(() => deleteAccountApi.error.value)

// return — только публичное, никаких *Api:
return { accounts, fetchAccounts, fetchAccountsLoading, ... }
```
- `*Api`-объекты никогда не выставляются наружу через return
- Данные всегда в `ref`, не в `computed(() => api.response.value?.data)`
- `execute()` возвращает `Promise<TData>` — данные получаем через `const { data } = await execute()`
- При ошибке `execute()` ставит `error.value` и пробрасывает throw — код после `await` не выполнится
- Не использовать `if (!data) return` после `await execute()` — ошибки уже обработаны через throw

## useReverseInfiniteScroll
Хук `shared/lib/useReverseInfiniteScroll.ts` — загрузка старых записей при скролле вверх.
- Слушает `window.scroll` (не контейнер)
- При `scrollY < 100` вызывает `loadOlderFn()`, затем восстанавливает позицию скролла через `window.scrollTo`
- Восстановление только если `addedHeight > 0` (предотвращает jitter)
- Вызывающий компонент обязан навешивать throttle (150 мс) самостоятельно

## Паттерн activity-log-table
- `ActivityLogTable` использует window scroll + `useReverseInfiniteScroll` для пагинации вверх
- Клик по строке таблицы разворачивает `ActivityLogExpandedRow` (без отдельной кнопки expand)
- `ActivityLogExpandedRow` показывает 3 секции: Vue↔Laravel / Laravel↔Python / Python↔Instagram
- Секции Vue↔Laravel и Python↔Instagram имеют вкладки Кратко/Подробно — только если данные содержат объекты/массивы (`hasNestedData`)
- Секция Laravel↔Python — всегда без вкладок (данные скалярные)
- Поля `*_preview` в response отображаются с иконкой ⓘ и tooltip о том, что это сокращённые данные

## Тесты (конвенции)
Запуск (в контейнерах): FE unit — `docker compose exec vue npx vitest run`; FE integration — `... vitest run --config vitest.integration.config.ts` (нужен живой laravel; иначе авто-skip); FE e2e — `... npx playwright test`; BE — `docker compose exec laravel php artisan test` (sqlite `:memory:`).
- **Авторитет покрытия по слоям, без дублей**: маппинг snake↔camel — только в `*DTO.spec` (store-тесты доказывают лишь запись в `ref`); дефолт `loading`/throw/`error.value` — только в `useApi.spec` (не повторять в каждом сторе); границы авторизации (401/403/404/ownership) — в Laravel Feature/e2e; шифрование — один авторитетный Model-unit на сущность
- **Параметризация однотипных кейсов**: FE — `it.each([...])`, BE — `#[\PHPUnit\Framework\Attributes\DataProvider('name')]` (БД-stateful кейсы только через DataProvider — даёт изоляцию `RefreshDatabase`, не через `foreach`). При слиянии сохранять каждый уникальный state-инвариант
- **Не писать тавтологии**: не тестировать `$fillable`/штатные касты Eloquent/Spatie-трейты/литералы конфига (`tries`, имя события), реактивность голого `ref`, `toBeDefined`/`toBeTruthy` без поведенческой проверки
- **Навигационный guard** тестируется через `authGuard` из `router/guard.ts` (реальная функция), а не через копию логики в тестовом роутере
- Ручные проверки с живым Instagram-аккаунтом (бывшие `@group instagram`-заглушки) вынесены в чек-лист `DEBUG_PROTOCOL.md`, а не висят пустыми `markTestSkipped`

## Отладка ошибок

### Где смотреть ошибки
- Ошибки видны в IDE (Volar + ESLint), при сборке `quasar build`, и вручную.
- Логи контейнера: `docker compose logs vue` или `docker compose logs -f vue`
- Ручная проверка TS: `docker compose exec vue npx vue-tsc --noEmit`

### Красный overlay ошибок в браузере (dev) — ВЫКЛЮЧЕН по умолчанию
Это «оверлей Vue с красными ошибками» = `vite-plugin-checker` (vueTsc + typed ESLint).
Он держит TS-программу в памяти (~1 ГБ на dev-контейнер), поэтому в dev отключён.
- **Включить overlay обратно**: запустить dev с `CHECK=1`, напр. внутри контейнера
  `CHECK=1 npx quasar dev --hostname 0.0.0.0` (или поменять command vue в docker-compose на `CHECK=1 ...`).
- Гейт в `frontend-vue/quasar.config.ts`: `ctx.prod || process.env.CHECK`. При сборке всегда включён.
- Если пользователь просит «включи оверлей с ошибками Vue / красные ошибки в браузере» — речь про это (`CHECK=1`).

### Workflow после реализации задачи
1. Сначала запустить ESLint autofix: `docker compose exec vue npx eslint --fix ./src`
2. Проверить оставшиеся TS ошибки: `docker compose exec vue npx vue-tsc --noEmit`
3. Исправлять вручную только то, что autofix не решил


# Параллельная мульти-агентная оркестрация

Когда фича декомпозируется на независимые куски (типично: 5–7 дашбордов/таблиц-страниц, каждый = свой
page-slice + свои widget/entity-слайсы), их можно строить параллельными субагентами в изолированных
git-worktree, а в конце собрать через ветки/merge. Подробный плейбук с worked-example и процедурой
интеграции — `ORCHESTRATION.md` (читать перед запуском фан-аута). Полная архитектура «фабрики»
массовой генерации админок (десятки экранов, контракт-first, гейты, кокпит, бюджет Kiro) — `AGENT-FACTORY.md`.

## Когда разворачивать (fan-out), а когда нет
- **Разворачивать**: ≥3 независимых единицы, каждая трогает в основном НОВЫЕ файлы (новые слайсы FSD),
  пересечение только по немногим shared-seam файлам.
- **Не разворачивать**: задача линейна, сильная связность правок, или почти всё идёт в одни и те же
  shared-файлы — тогда параллелизм даёт только merge-конфликты.

## Гарантия полного контекста каждому агенту
- **По умолчанию (без настройки)**: каждый субагент, запущенный через Task/Agent, автоматически грузит
  весь стек памяти — `~/.claude/CLAUDE.md`, корневой `CLAUDE.md` проекта, его `@import`-ы (рекурсивно,
  до 4 хопов) и auto-memory (первые 200 строк / 25 КБ `MEMORY.md`). Это значит: правила этого файла
  доходят до агентов сами, дублировать их в промпт НЕ нужно.
- **Исключение — встроенные Explore и Plan**: они НАМЕРЕННО пропускают `CLAUDE.md` и git-status ради
  скорости. Если оркестратор раздаёт работу через Explore/Plan — критичные правила (FSD-слои, паттерн
  стора/таблицы, контракт shared-компонентов) нужно ПОВТОРИТЬ прямо в delegation-промпте.
- **Что всё равно кладём в Task-промпт каждому**: конкретный scope (какие слайсы создаёт агент),
  точные пути shared-контрактов для чтения, имя ветки/worktree, запрет трогать seam-файлы. Контекст —
  это контекст, не принудиловка: чем конкретнее промпт, тем выше следование.
- **Новая сессия**: `CLAUDE.md` + memory грузятся автоматически на старте, ручного шага нет. Проверка
  состава — команда `/memory`.

## Git: изоляция и интеграция
- Каждый агент работает в своём worktree (`isolation: worktree` во frontmatter субагента либо просьба
  «используй worktree для агентов»): отдельный каталог `.claude/worktrees/<name>/` и ветка
  `worktree-<name>`, общая история репозитория.
- **Авто-уборка только для worktree БЕЗ изменений** (нет правок, untracked-файлов и новых коммитов).
  Worktree с коммитами/правками НЕ удаляется сам — нужен `git worktree remove` вручную либо ждать
  истечения `cleanupPeriodDays`. Поэтому каждый агент обязан закоммитить свою единицу.
- Интеграция: ветки агентов → ревью diff → merge в основную по одному слайсу. `cherry-pick` — для
  переноса отдельного «чистого» коммита; `stash` — только для временного разведения контекста внутри
  сессии. Полную процедуру см. в `ORCHESTRATION.md`.

## Контракт shared-компонентов (правило когерентности)
- Слой `shared/ui/*` и `shared/lib/*` — координируемый шов. Его расширяют ОДИН раз ДО фан-аута; агенты
  его только читают, не правят параллельно.
- НОВЫЙ shared-компонент = своя папка `shared/ui/<kebab>/` + `index.ts` (аддитивно, без конфликтов).
  Добавление экспорта в СУЩЕСТВУЮЩИЙ barrel — это seam, делается последовательно, не агентами враздрай.
- **Merge-conflict hotspots (сериализовать, не отдавать параллельно)**: `src/router/routes.ts`,
  `src/layouts/AppNavTabs.vue` (навигация), на бэке — `routes/api.php` и `AppServiceProvider.php`.
  Регистрацию маршрутов/табов/биндингов делает оркестратор после слияния слайсов, либо отдельный
  финальный шаг одним агентом.

## Маршрутизация через 3 Kiro-канала
Claude Code умеет смотреть только на ОДИН base URL (`ANTHROPIC_BASE_URL`) — он меняет КУДА уходят
запросы, а не КАКАЯ модель отвечает. Балансировку по 3 Kiro-аккаунтам делает CLI Proxy (порт 8318),
не Claude Code. Per-agent override поддержан только для `model`, не для base URL. Конфиг и оговорки
(tool-name limit 64 символа, request-spacing per-account) — в `ORCHESTRATION.md`. Требует
подтверждения пользователя перед включением.
