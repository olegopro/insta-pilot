# PLAN-TESTS — План реализации тестов

## Типы тестов по слоям

```
Laravel Backend
├── Unit tests          — изолированные классы, без DB/HTTP, моки через Mockery
└── Feature tests       — HTTP endpoint → Controller → SQLite in-memory (интеграционные)

Vue Frontend
├── Unit tests          — composables, stores, утилиты (Vitest + mock axios)
├── Component tests     — Vue компоненты с Vue Test Utils + Vitest
└── E2E tests           — полный пользовательский флоу в браузере (Playwright)
```

---

## Часть 1 — Laravel Backend

### Инфраструктура (уже готово)
- `phpunit.xml` — SQLite `:memory:` для всех тестов
- `tests/TestCase.php` — базовый класс
- `database/factories/UserFactory.php` — фабрика User

**Что нужно добавить:**
- Фабрику `InstagramAccountFactory`
- Трейт `WithRoles` для быстрого создания ролей в тестах (через Spatie)
- Возможно: `RefreshDatabase` или `LazilyRefreshDatabase` трейт в базовом TestCase

---

### 1.1 Feature Tests — Auth (`tests/Feature/Auth/AuthTest.php`)

Тестируемые маршруты: `POST /api/auth/register`, `POST /api/auth/login`,
`POST /api/auth/logout`, `GET /api/auth/me`

| Тест                                                | Метод + URL                       | Ожидание                            |
|-----------------------------------------------------|-----------------------------------|-------------------------------------|
| `test_user_can_register`                            | POST /auth/register               | 201, поля `data.user`, `data.token` |
| `test_register_validates_required_fields`           | POST /auth/register (пусто)       | 422                                 |
| `test_register_fails_if_email_duplicate`            | POST /auth/register (дубль email) | 422                                 |
| `test_user_can_login`                               | POST /auth/login                  | 200, `data.token` не пустой         |
| `test_login_fails_with_wrong_password`              | POST /auth/login                  | 422                                 |
| `test_inactive_user_cannot_access_protected_routes` | GET /auth/me (is_active=false)    | 403                                 |
| `test_user_can_logout`                              | POST /auth/logout (с токеном)     | 200, токен удалён                   |
| `test_me_returns_authenticated_user`                | GET /auth/me (с токеном)          | 200, email совпадает                |
| `test_unauthenticated_cannot_access_me`             | GET /auth/me (без токена)         | 401                                 |

---

### 1.2 Feature Tests — Admin Users (`tests/Feature/Admin/AdminUserTest.php`)

Тестируемые маршруты: `GET /api/admin/users`, `PATCH /api/admin/users/{id}/toggle-active`,
`PATCH /api/admin/users/{id}/role`

| Тест                                              | Ожидание                      |
|---------------------------------------------------|-------------------------------|
| `test_admin_can_list_all_users`                   | 200, массив пользователей     |
| `test_non_admin_cannot_list_users`                | 403                           |
| `test_unauthenticated_cannot_access_admin`        | 401                           |
| `test_admin_can_deactivate_user`                  | 200, `data.is_active = false` |
| `test_admin_can_activate_user`                    | 200, `data.is_active = true`  |
| `test_admin_can_change_user_role_to_admin`        | 200, роль = admin             |
| `test_admin_can_change_user_role_to_user`         | 200, роль = user              |
| `test_toggle_active_returns_404_for_unknown_user` | 404                           |
| `test_update_role_validates_role_value`           | 422 (значение не admin/user)  |

---

### 1.3 Feature Tests — Instagram Accounts (`tests/Feature/InstagramAccount/InstagramAccountTest.php`)

> Метод `login()` обращается к Python-сервису через `InstagramClientServiceInterface`.
> В тестах сервис **мокируется** через `$this->mock(InstagramClientServiceInterface::class)`.

Тестируемые маршруты: `GET /api/accounts`, `POST /api/accounts/login`,
`GET /api/accounts/{id}`, `DELETE /api/accounts/{id}`

| Тест                                               | Ожидание                                                           |
|----------------------------------------------------|--------------------------------------------------------------------|
| `test_user_sees_only_own_accounts`                 | GET /accounts → только аккаунты текущего user_id                   |
| `test_user_cannot_see_another_users_account`       | GET /accounts/{id} (чужой) → 404                                   |
| `test_user_cannot_delete_another_users_account`    | DELETE /accounts/{id} (чужой) → 404                                |
| `test_unauthenticated_cannot_list_accounts`        | GET /accounts → 401                                                |
| `test_account_login_creates_account_with_user_id`  | POST /accounts/login (мок клиента) → 200, `data.user_id` = текущий |
| `test_account_login_fails_if_client_returns_error` | POST /accounts/login (мок возвращает failure) → 422                |
| `test_account_login_validates_required_fields`     | POST /accounts/login (пусто) → 422                                 |
| `test_user_can_delete_own_account`                 | DELETE /accounts/{id} (свой) → 200                                 |

---

### 1.4 Unit Tests — UserRepository (`tests/Unit/UserRepositoryTest.php`)

> Unit-тест репозитория использует SQLite, поэтому технически это integration,
>, но в Laravel принято размещать такие тесты в `tests/Unit`.

| Тест                                          | Ожидание                |
|-----------------------------------------------|-------------------------|
| `test_toggle_active_deactivates_active_user`  | is_active: true → false |
| `test_toggle_active_activates_inactive_user`  | is_active: false → true |
| `test_update_role_assigns_new_role`           | роль меняется корректно |
| `test_find_by_id_returns_null_for_unknown_id` | null                    |

---

### Запуск тестов (Laravel)

```bash
# Все тесты
docker compose exec laravel php artisan test

# Только Feature
docker compose exec laravel php artisan test --testsuite=Feature

# Только Unit
docker compose exec laravel php artisan test --testsuite=Unit

# Конкретный файл
docker compose exec laravel php artisan test tests/Feature/Auth/AuthTest.php

# С покрытием (требует Xdebug или PCOV)
docker compose exec laravel php artisan test --coverage
```

---

## Часть 2 — Vue Frontend

### Инфраструктура (нужно установить)

**Зависимости:**
```bash
npm install -D vitest @vue/test-utils happy-dom @vitest/coverage-v8
```

**`vitest.config.ts`** (создать в `frontend-vue/`):
```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  }
})
```

**`package.json` scripts** — добавить:
```json
"test:unit": "vitest run",
"test:unit:watch": "vitest",
"test:unit:coverage": "vitest run --coverage"
```

> **Quasar-специфика:** компоненты Quasar (`q-btn`, `q-table` и т.д.) в unit/component тестах
> нужно либо регистрировать через `installQuasar()` из `@quasar/quasar-app-extension-testing-unit-vitest`,
> либо стаббировать. Проще стаббировать для unit-тестов.

---

### 2.1 Unit Tests — useApi (`src/shared/api/__tests__/useApi.spec.ts`)

| Тест                                                   | Ожидание                                   |
|--------------------------------------------------------|--------------------------------------------|
| `loading становится true во время запроса`             | loading.value === true во время выполнения |
| `data содержит результат после успеха`                 | data.value === результат запроса           |
| `error содержит сообщение при AxiosError`              | error.value === response.data.error        |
| `loading сбрасывается в false после завершения`        | loading.value === false                    |
| `повторный execute сбрасывает предыдущий data и error` | data/error = null перед запросом           |

---

### 2.2 Unit Tests — authStore (`src/entities/user/model/__tests__/authStore.spec.ts`)

Мокируем: `api` из `@/boot/axios`, `localStorage`

| Тест                                    | Ожидание                              |
|-----------------------------------------|---------------------------------------|
| `login сохраняет токен в localStorage`  | localStorage.setItem вызван с токеном |
| `login сохраняет user в store`          | user.value === user из ответа         |
| `logout удаляет токен из localStorage`  | localStorage.removeItem вызван        |
| `clearAuth обнуляет user`               | user.value === null                   |
| `isAuthenticated = false при null user` | computed возвращает false             |
| `isAdmin = true если есть роль admin`   | computed возвращает true              |

---

### 2.3 Unit Tests — adminUsersStore (`src/entities/user/model/__tests__/adminUsersStore.spec.ts`)

| Тест                                      | Ожидание                      |
|-------------------------------------------|-------------------------------|
| `fetchUsers вызывает GET /admin/users`    | api.get вызван с нужным URL   |
| `toggleActive вызывает PATCH с нужным id` | api.patch вызван правильно    |
| `updateRole отправляет role в теле`       | api.patch вызван с `{ role }` |

---

### 2.4 Component Tests — LoginForm (`src/features/auth-login/ui/__tests__/LoginForm.spec.ts`)

Мокируем: `useAuthStore`, `useRouter`, `Notify`

| Тест                                      | Ожидание                                       |
|-------------------------------------------|------------------------------------------------|
| `рендерит поля email и password`          | input[type=email] и input[type=password] в DOM |
| `submitHandler вызывает authStore.login`  | authStore.login вызван с email/password        |
| `при ошибке показывает Notify.create`     | Notify.create вызван                           |
| `кнопка задизейблена пока loading = true` | атрибут loading присутствует                   |

---

### 2.5 E2E Tests — Playwright (`e2e/`)

**Установка:**
```bash
npm install -D @playwright/test
npx playwright install chromium
```

**`playwright.config.ts`:**
```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:9000' }
})
```

**Тесты:**

`e2e/auth.spec.ts`
| Тест | Сценарий |
|---|---|
| `успешный логин` | Открыть /login → ввести admin@insta-pilot.local / password → нажать Войти → оказаться на / |
| `неверный пароль` | Ввести неверный пароль → появился Notify с ошибкой |
| `редирект на /login без токена` | Открыть / без токена → оказаться на /login |
| `гость не может зайти на /admin/users` | Открыть /admin/users без авторизации → редирект на /login |

`e2e/admin-users.spec.ts`
| Тест | Сценарий |
|---|---|
| `admin видит список пользователей` | Войти как admin → перейти на /admin/users → таблица с пользователями отображается |
| `не-admin не может зайти на /admin/users` | Войти как user → попытка зайти на /admin/users → редирект на / |

### Запуск тестов (Vue)

```bash
# Unit + Component
docker compose exec vue npm run test:unit

# Watch-режим
docker compose exec vue npm run test:unit:watch

# E2E (требует запущенного приложения)
docker compose exec vue npx playwright test

# E2E с UI-режимом
docker compose exec vue npx playwright test --ui
```

---

## Порядок реализации

1. **Laravel Feature Tests** — AuthTest → AdminUserTest → InstagramAccountTest
2. **Laravel Unit Tests** — UserRepositoryTest
3. **Vue инфраструктура** — установка Vitest, vitest.config.ts
4. **Vue Unit Tests** — useApi → authStore → adminUsersStore
5. **Vue Component Tests** — LoginForm
6. **Vue E2E** — Playwright, auth сценарии

---

## Что не тестируем (и почему)

- `InstagramClientService` — интеграция с Python-сервисом, в тестах мокируется целиком
- Quasar-специфичные компоненты (`ButtonComponent`, `InputComponent`) — тривиальные обёртки без логики
- Python-сервис — отдельный слой, свои тесты (pytest), вне scope этого плана
