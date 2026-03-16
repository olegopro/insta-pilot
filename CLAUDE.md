# insta-pilot — Project Memory

## Project Overview
Instagram auto-liker web service.
Stack: Laravel 12 (backend) + Python FastAPI + instagrapi (Instagram layer) + Vue 3 + Quasar (frontend).
DB: PostgreSQL 16. Queue: Redis.

## Project Structure
```
insta-pilot/
├── backend-laravel/    # Laravel 12, PHP 8.3
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

---

## Plan & Progress
- [PLAN.md](PLAN.md) — Master Plan (фазы, чеклист, архитектура)
- [PLAN-EXTEND-BACK.md](PLAN-EXTEND-BACK.md) — Backend детали (Laravel + Python)
- [PLAN-EXTEND-FRONT.md](PLAN-EXTEND-FRONT.md) — Frontend детали (Vue + Quasar, FSD)
- [PLAN-EXTEND-LOGGING-BACKEND.md](PLAN-EXTEND-LOGGING-BACKEND.md) — Мониторинг: Backend
- [PLAN-EXTEND-LOGGING-FRONT.md](PLAN-EXTEND-LOGGING-FRONT.md) — Мониторинг: Frontend
- [PLAN-EXTEND-LOGGING-FULL.md](PLAN-EXTEND-LOGGING-FULL.md) — Полный план фазы логирования

---

# Backend — Laravel 12

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
| instagram_login         | string, unique        | логин                   |
| instagram_password      | text                  | зашифрован              |
| session_data            | text, nullable        | JSON сессии, зашифрован |
| proxy                   | string, nullable      | прокси                  |
| full_name               | string, nullable      | имя из Instagram        |
| profile_pic_url         | text, nullable        | URL аватарки            |
| device_profile_id       | FK, nullable          | профиль устройства      |
| device_settings         | json, nullable        | UUID устройства и др.   |
| is_active               | boolean, default true |                         |
| last_used_at            | timestamp, nullable   |                         |
| created_at / updated_at | timestamps            |                         |

Шифрование через Accessors в модели с `INSTAGRAM_SALT` → `config('app.instagram_salt')`.

## Таблица device_profiles
| Поле         | Тип    | Описание                        |
|--------------|--------|---------------------------------|
| id           | bigIncrements | PK                        |
| name         | string | название профиля                |
| manufacturer | string | производитель                   |
| model        | string | модель устройства               |
| android_version | string | версия Android               |
| app_version  | string | версия приложения Instagram     |
| user_agent   | text   | User-Agent строка               |

Данные хранятся в `backend-laravel/data/device-profiles/device-profiles.json`. Заполняются через `DeviceProfileSeeder`. Назначается аккаунту при добавлении — передаётся в Python как заголовки запросов.

## Таблица account_activity_logs
| Поле              | Тип            | Описание                                 |
|-------------------|----------------|------------------------------------------|
| id                | bigIncrements  | PK                                       |
| instagram_account_id | FK          | аккаунт                                  |
| action            | string         | тип действия (login, like, comment, ...) |
| status            | string         | success / fail                           |
| duration_ms       | integer, nullable | время выполнения запроса              |
| vue_request       | json, nullable | данные из Vue → Laravel                  |
| vue_response      | json, nullable | данные ответа Laravel → Vue              |
| python_request    | json, nullable | данные Laravel → Python                  |
| python_response   | json, nullable | данные ответа Python → Laravel           |
| instagram_request | json, nullable | данные Python → Instagram                |
| instagram_response| json, nullable | данные ответа Instagram → Python         |
| error_message     | text, nullable | текст ошибки                             |
| created_at        | timestamp      |                                          |

Логирование через `ActivityLoggerService` / `ActivityLoggerServiceInterface`. Репозиторий: `ActivityLogRepository`. Broadcasting event: `ActivityLogCreated` (канал `private:activity-log`).

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
| `private:activity-log` | `ActivityLogCreated` | новая запись лога в реальном времени |

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
- Стиль кода: стрелочные функции без `{}` если тело — один expression (`.catch(() => Notify.create(...))`)
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

## Отладка ошибок

### Где смотреть ошибки
- Overlay в браузере (vue-tsc/ESLint) = те же ошибки, что в логах Docker vue-контейнера
- Логи контейнера: `docker compose logs vue` или `docker compose logs -f vue`
- Ручная проверка TS: `docker compose exec vue npx vue-tsc --noEmit`

### Workflow после реализации задачи
1. Сначала запустить ESLint autofix: `docker compose exec vue npx eslint --fix ./src`
2. Проверить оставшиеся TS ошибки: `docker compose exec vue npx vue-tsc --noEmit`
3. Исправлять вручную только то, что autofix не решил
