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
- `vue`      → port 9000
- `laravel`  → port 8000
- `python`   → port 8001
- `postgres` → port 5432 (PostgreSQL 16)
- `redis`    → port 6379

## Environment
Root `.env`: `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `INSTAGRAM_SALT`
Frontend `.env`: `VITE_API_URL=http://localhost:8000/api/`
Laravel: `INSTAGRAM_PYTHON_URL=http://python:8001` (внутренний Docker URL)

## Data Flow
```
Quasar Form → Laravel API → Python FastAPI (instagrapi) → Instagram
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

## User Preferences
- Answer in Russian
- User writes code themselves — give hints, not full implementations
- No implementation without explicit request — plan first

---

## Plan & Progress
- [PLAN.md](PLAN.md) — Master Plan (фазы, чеклист, архитектура)
- [PLAN-EXTEND-BACK.md](PLAN-EXTEND-BACK.md) — Backend детали (Laravel + Python)
- [PLAN-EXTEND-FRONT.md](PLAN-EXTEND-FRONT.md) — Frontend детали (Vue + Quasar, FSD)

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
Models/                       # Eloquent, шифрование через Accessors
Providers/AppServiceProvider  # все bindings в register()
Repositories/                 # Interface + Implementation
Services/                     # Interface + Implementation
Facades/                      # extends Facade → aliases в config/app.php
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
| is_active               | boolean, default true |                         |
| last_used_at            | timestamp, nullable   |                         |
| created_at / updated_at | timestamps            |                         |

Шифрование через Accessors в модели с `INSTAGRAM_SALT` → `config('app.instagram_salt')`.

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
- Шаблоны: никогда не добавлять `.value` — Vue автоматически разворачивает `Ref` в `<template>`
- Уведомления: использовать `notifyError` / `notifySuccess` из `@/shared/lib`, а не `Notify.create` напрямую
- Trailing comma в объектах не ставится: `{ a: 1, b: 2 }`, не `{ a: 1, b: 2, }`; правило распространяется и на объект с одним свойством: `{ a: 1 }`, не `{ a: 1, }`

## Обёртки над Quasar-компонентами (shared/ui)

Каждый UI-компонент — обёртка над Quasar с полным автокомплитом пропсов в родителе.

**Паттерн:**
- `interface XxxComponentProps extends Omit<QXxxProps, 'modelValue'>` — даёт автокомплит всех Quasar-пропсов; `modelValue` исключают через `Omit`, т.к. он объявлен через `defineModel`
- `useForwardProps(props)` из `@/shared/lib` — фильтрует `undefined`, предотвращает Vue-boolean-кастинг (без этого `outlined: false` перезатрёт дефолт Quasar)
- `v-bind="{ ...$attrs, ...forwarded }"` — `$attrs` несёт нативные атрибуты (`class`, `autocomplete`), `forwarded` — Quasar-пропсы и события
- `defineOptions({ inheritAttrs: false })` — не даёт `$attrs` упасть на корневой элемент автоматически
- `defineModel` — двусторонний бинд вместо ручного `:modelValue` + `emit`
- Слоты: proxy через `v-for` по `$slots` → пробрасываются все слоты Quasar-компонента
- `export interface XxxComponentProps` + реэкспорт через `index.ts` сегмента

**Почему `useForwardProps` возвращает `Partial<T>`:**
Vue при `defineProps<T>()` применяет boolean-кастинг — все необъявленные boolean-пропсы превращаются из `undefined` в `false`. `useForwardProps` фильтрует `undefined`-значения, чтобы не перезатирать дефолты дочернего компонента. Возвращаемый тип `Partial<T>` — единственный корректный вариант, т.к. TypeScript не может знать, какие пропсы реально передал родитель. Возврат `T` вместо `Partial<T>` ломает `exactOptionalPropertyTypes` — известное ограничение Vue language-tools.

**Особый случай — обязательные пропсы:**
`useForwardProps` возвращает `Partial<T>`, что делает required-пропсы опциональными для TypeScript. Для компонентов с required-пропсами нужен cast в шаблоне: `v-bind="({ ...$attrs, ...forwarded }) as QXxxProps"`.

Quasar-компоненты с required-пропсами (кроме `modelValue`):
| Компонент | Required-пропсы | Нужен cast |
|---|---|---|
| QTableProps | `rows` | `as QTableProps` |
| QTreeProps | `nodes`, `nodeKey` | `as QTreeProps` |
| QVideoProps | `src` | `as QVideoProps` |
| QPaginationProps | `max` | `as QPaginationProps` |
| QStepProps | `name`, `title` | `as QStepProps` |
| QTabPanelProps | `name` | `as QTabPanelProps` |
| QCarouselSlideProps | `name` | `as QCarouselSlideProps` |
| QRadioProps | `val` | `as QRadioProps` |

Все остальные компоненты (QInput, QSelect, QBtn, QToggle и др.) — все пропсы кроме `modelValue` опциональны, cast не нужен.

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
  api/
    index.ts             # export { useApi, type ApiResponseWrapper }
    types.ts             # ApiResponseWrapper<T>
    useApi.ts            # generic composable { execute, loading, response, error }
  lib/
    index.ts             # export { type Nullable }
    types.ts             # Nullable<T>
  ui/
    button-component/    # каждый компонент — своя папка (kebab-case) + index.ts
    input-component/
    modal-component/
    select-component/
    toggle-component/

entities/
  instagram-account/
    model/
      types.ts           # InstagramAccount, LoginRequest, LoginResponse
      accountStore.ts    # Pinia store
    ui/
      ProfileCard.vue

features/                # действия пользователя (add-instagram-account, delete-...)
widgets/                 # крупные блоки страниц (instagram-accounts-list)

pages/
  login/ui/LoginPage.vue
  instagram-accounts/ui/InstagramAccountsPage.vue
```

## Нейминг
- `instagram-account` — Instagram аккаунт в системе
- `user` — пользователь системы insta-pilot (будет позже, с авторизацией)

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

## Отладка ошибок

### Где смотреть ошибки
- Overlay в браузере (vue-tsc/ESLint) = те же ошибки, что в логах Docker vue-контейнера
- Логи контейнера: `docker compose logs vue` или `docker compose logs -f vue`
- Ручная проверка TS: `docker compose exec vue npx vue-tsc --noEmit`

### Workflow после реализации задачи
1. Сначала запустить ESLint autofix: `docker compose exec vue npx eslint --fix ./src`
2. Проверить оставшиеся TS ошибки: `docker compose exec vue npx vue-tsc --noEmit`
3. Исправлять вручную только то, что autofix не решил
