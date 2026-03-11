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
| Поле | Тип | Описание |
|------|-----|----------|
| id | bigIncrements | PK |
| instagram_login | string, unique | логин |
| instagram_password | text | зашифрован |
| session_data | text, nullable | JSON сессии, зашифрован |
| proxy | string, nullable | прокси |
| full_name | string, nullable | имя из Instagram |
| profile_pic_url | text, nullable | URL аватарки |
| is_active | boolean, default true | |
| last_used_at | timestamp, nullable | |
| created_at / updated_at | timestamps | |

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
- Внутри `defineStore` setup: `data.value` нужно (это обычный `shallowRef`)
- В компоненте через `store.someApi.data`: `.value` НЕ нужно — Pinia применяет `UnwrapRef` рекурсивно, ref уже развёрнут
- Правило: если пишешь `store.*.data.value` в компоненте — это ошибка TS

## Отладка ошибок

### Где смотреть ошибки
- Overlay в браузере (vue-tsc/ESLint) = те же ошибки, что в логах Docker vue-контейнера
- Логи контейнера: `docker compose logs vue` или `docker compose logs -f vue`
- Ручная проверка TS: `docker compose exec vue npx vue-tsc --noEmit`

### Workflow после реализации задачи
1. Сначала запустить ESLint autofix: `docker compose exec vue npx eslint --fix ./src`
2. Проверить оставшиеся TS ошибки: `docker compose exec vue npx vue-tsc --noEmit`
3. Исправлять вручную только то, что autofix не решил
