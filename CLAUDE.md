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

## User Preferences
- Answer in Russian
- User writes code themselves — give hints, not full implementations
- No implementation without explicit request — plan first

---

## Plan & Progress
См. [PLAN.md](PLAN.md)

---

# Backend — Laravel 12

## Правила
- `declare(strict_types=1)` в каждом PHP файле
- Controllers: `final class`, только `JsonResponse` в return
- DI через конструктор, `private readonly`
- Паттерн: Interface → Implementation → bind в AppServiceProvider → (опционально) Facade
- API routes в Laravel 12 не включены по умолчанию — добавить в `bootstrap/app.php`

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

## Архитектура: FSD (Feature-Sliced Design)
Документация: https://feature-sliced.design/docs
Context7 library ID: `/feature-sliced/documentation`

## Правила
- Порядок блоков SFC: `<script setup lang="ts">` → `<template>` → `<style>`
- Импорты: через `src/` (не `./` или `../`)
- Обработчики событий: суффикс `Handler` (`submitHandler`)
- UI компоненты: только кастомные обёртки из `shared/ui/` (ButtonComponent, InputComponent, ...) над Quasar, суффикс `Component`
- Каждый action в store — через `useApi`, никакого внутреннего state в store
- Public API слайсов — через `index.ts` в каждом сегменте

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
    useApi.ts            # generic composable { execute, loading, data }
  lib/
    index.ts             # export { type Nullable }
    types.ts             # Nullable<T>
  ui/
    button-component/    # каждый компонент — своя папка (kebab-case) + index.ts
    input-component/
    modal-component/

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
