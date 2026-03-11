# Фаза 2 — Instagram Accounts (детальный план)

## Обзор

Главная страница приложения: таблица Instagram-аккаунтов с действиями (добавить, удалить, просмотреть).
LoginPage удаляется — она была временной.

---

## 1. Структура файлов (создать)

```
src/
├── entities/
│   └── instagram-account/
│       └── model/
│           ├── types.ts           # ← ОБНОВИТЬ (добавить поля)
│           └── accountStore.ts    # ← ОБНОВИТЬ (добавить actions)
│
├── features/
│   ├── add-instagram-account/
│   │   ├── ui/
│   │   │   └── AddInstagramAccountModal.vue
│   │   └── index.ts
│   │
│   ├── delete-instagram-account/
│   │   ├── ui/
│   │   │   └── DeleteInstagramAccountModal.vue
│   │   └── index.ts
│   │
│   └── view-instagram-account/
│       ├── ui/
│       │   └── ViewInstagramAccountModal.vue
│       └── index.ts
│
├── widgets/
│   └── instagram-accounts-list/
│       ├── ui/
│       │   └── InstagramAccountsList.vue
│       └── index.ts
│
└── pages/
    └── instagram-accounts/
        ├── ui/
        │   └── InstagramAccountsPage.vue
        └── index.ts
```

### Удалить

- `src/pages/login/` — вся папка (LoginPage была временной)

---

## 2. FSD нейминг — правила

| Что | Формат | Пример |
|-----|--------|--------|
| Папки слайсов | `kebab-case` | `add-instagram-account/` |
| Сегменты | стандартные имена | `ui/`, `model/`, `api/`, `lib/` |
| Vue компоненты | `PascalCase` | `AddInstagramAccountModal.vue` |
| Public API | `index.ts` в корне слайса | `export { AddInstagramAccountModal } from './ui/...'` |
| Обработчики событий | суффикс `Handler` | `submitHandler`, `deleteHandler` |
| Импорты | через `src/` | `import { ... } from 'src/entities/instagram-account/model/...'` |
| Порядок блоков SFC | `<script setup>` → `<template>` → `<style>` | |
| UI компоненты | только из `shared/ui/` | `ButtonComponent`, `InputComponent`, `ModalComponent` |

---

## 3. Backend — изменения

### 3.1. Новые роуты (`routes/api.php`)

```php
Route::prefix('accounts')->group(function () {
    Route::get('/', [InstagramAccountController::class, 'index']);        // уже есть
    Route::post('/login', [InstagramAccountController::class, 'login']); // уже есть
    Route::get('/{id}', [InstagramAccountController::class, 'show']);     // НОВЫЙ
    Route::delete('/{id}', [InstagramAccountController::class, 'destroy']); // НОВЫЙ
});
```

### 3.2. Controller — новые методы (`InstagramAccountController.php`)

**show($id)** — детальная информация об аккаунте:
```php
// 1. Получить аккаунт из БД через repository->findById($id)
// 2. Если есть session_data → вызвать InstagramClientService->getUserInfo(sessionData)
//    → получить followers_count, following_count
// 3. Вернуть объединённые данные (БД + Instagram API)
// Ответ: { success: true, data: { ...account, followers_count, following_count }, message: 'OK' }
// Ошибка 404: { success: false, error: 'Account not found' }
```

**destroy($id)** — удалить аккаунт:
```php
// 1. Вызвать repository->deleteAccount($id)
// 2. Вернуть { success: true, data: null, message: 'Account deleted' }
// Ошибка 404: { success: false, error: 'Account not found' }
```

### 3.3. Repository — новый метод (`InstagramAccountRepositoryInterface.php`)

```php
public function findById(int $id): InstagramAccount | null;
```

Реализация в `InstagramAccountRepository.php`:
```php
public function findById(int $id): InstagramAccount | null
{
    return InstagramAccount::find($id);
}
```

### 3.4. Валидация уникальности в `login()`

В контроллере **login()** добавить проверку:
```php
$request->validate([
    'instagram_login'    => 'required|string|unique:instagram_accounts,instagram_login',
    'instagram_password' => 'required|string',
    'proxy'              => 'nullable|string',
]);
```

Laravel автоматически вернёт **422** с ошибкой валидации при дубликате.
Для единообразия — обернуть в try/catch и вернуть в формате:
```json
{ "success": false, "error": "Аккаунт с таким логином уже существует" }
```

---

## 4. Frontend — Entity (обновление)

### 4.1. Обновить типы (`entities/instagram-account/model/types.ts`)

```typescript
import type { Nullable } from 'src/shared/lib'

// Базовый тип — то, что приходит в списке
export interface InstagramAccount {
  id: number
  instagram_login: string
  full_name: Nullable<string>
  profile_pic_url: Nullable<string>
  proxy: Nullable<string>
  is_active: boolean
  created_at: string
}

// Детальный тип — то, что приходит при просмотре (GET /accounts/:id)
export interface InstagramAccountDetailed extends InstagramAccount {
  followers_count: Nullable<number>
  following_count: Nullable<number>
}

// Запрос на добавление аккаунта
export interface AddAccountRequest {
  instagram_login: string
  instagram_password: string
  proxy?: string
}

// Ответ на добавление = базовый аккаунт
export type AddAccountResponse = InstagramAccount
```

> **Примечание:** `LoginRequest` и `LoginResponse` переименовать в `AddAccountRequest` и `AddAccountResponse` — логичнее по смыслу (это не логин пользователя, а добавление Instagram-аккаунта).

### 4.2. Обновить store (`entities/instagram-account/model/accountStore.ts`)

```typescript
import { defineStore } from 'pinia'
import { api } from 'src/boot/axios'
import { useApi, type ApiResponseWrapper } from 'src/shared/api'
import type {
  InstagramAccount,
  InstagramAccountDetailed,
  AddAccountRequest,
  AddAccountResponse,
} from 'src/entities/instagram-account/model/types'

export const useAccountStore = defineStore('accounts', () => {

  // Список всех аккаунтов
  const fetchAccounts = useApi<ApiResponseWrapper<InstagramAccount[]>>(
    () => api.get('/accounts/').then((r) => r.data)
  )

  // Добавить аккаунт (бывший login)
  const addAccount = useApi<ApiResponseWrapper<AddAccountResponse>, AddAccountRequest>(
    (args) => api.post('/accounts/login', args).then((r) => r.data)
  )

  // Детальная информация об аккаунте
  const fetchAccountDetails = useApi<ApiResponseWrapper<InstagramAccountDetailed>, number>(
    (id) => api.get(`/accounts/${id}`).then((r) => r.data)
  )

  // Удалить аккаунт
  const deleteAccount = useApi<ApiResponseWrapper<null>, number>(
    (id) => api.delete(`/accounts/${id}`).then((r) => r.data)
  )

  return { fetchAccounts, addAccount, fetchAccountDetails, deleteAccount }
})
```

---

## 5. Frontend — shared/api (обновление useApi)

### 5.1. Добавить обработку ошибок в `useApi`

Текущая реализация не ловит ошибки. Обновить:

```typescript
import type { Nullable } from 'src/shared/lib'
import { ref, shallowRef } from 'vue'

export function useApi<TData, TArgs = void>(
  fn: (args: TArgs) => Promise<TData>
) {
  const loading = ref(false)
  const data = shallowRef<Nullable<TData>>(null)
  const error = shallowRef<Nullable<string>>(null)

  const execute = async (args: TArgs) => {
    loading.value = true
    error.value = null

    try {
      data.value = await fn(args)
    } catch (e: unknown) {
      if (e instanceof Error && 'response' in e) {
        const axiosError = e as { response?: { data?: { error?: string } } }
        error.value = axiosError.response?.data?.error ?? 'Неизвестная ошибка'
      } else {
        error.value = 'Ошибка сети'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  return { execute, loading, data, error }
}
```

---

## 6. Frontend — Features

### 6.1. `features/add-instagram-account/`

**Файл:** `ui/AddInstagramAccountModal.vue`

**Что делает:** Модалка с формой добавления Instagram-аккаунта.

**Структура:**
```
┌──────────────────────────────────┐
│  Добавить аккаунт            [X] │
│──────────────────────────────────│
│  Логин Instagram:                │
│  [________________________]      │
│                                  │
│  Пароль Instagram:               │
│  [________________________]  👁  │
│                                  │
│  Прокси (необязательно):         │
│  [________________________]      │
│                                  │
│          [Отмена] [Добавить]     │
└──────────────────────────────────┘
```

**Props & Emits:**
```typescript
// Props — нет (модалка сама управляет формой)
// Emits:
defineEmits<{
  (e: 'added'): void  // аккаунт успешно добавлен → обновить таблицу
}>()
```

**v-model:** Использовать `ModalComponent` с `v-model` для открытия/закрытия.

**Логика:**
1. Форма с тремя `InputComponent`: логин (required), пароль (required, type="password"), прокси (optional)
2. Валидация: логин и пароль обязательны (использовать `:rules` на `InputComponent`)
3. При сабмите → `store.addAccount.execute(form)`
4. При **успехе** (`data.success === true`):
   - Показать `Notify.create({ type: 'positive', message: 'Аккаунт добавлен' })`
   - Emit `'added'`
   - Закрыть модалку
   - Очистить форму
5. При **ошибке** (catch):
   - Показать `Notify.create({ type: 'negative', message: store.addAccount.error })`
   - Модалку **не** закрывать

**Использование Quasar Notify:**
```typescript
import { Notify } from 'quasar'

Notify.create({
  type: 'positive', // или 'negative'
  message: 'Текст уведомления',
  position: 'top-right',
})
```

**index.ts:**
```typescript
export { default as AddInstagramAccountModal } from './ui/AddInstagramAccountModal.vue'
```

---

### 6.2. `features/delete-instagram-account/`

**Файл:** `ui/DeleteInstagramAccountModal.vue`

**Что делает:** Модалка подтверждения удаления аккаунта.

**Структура:**
```
┌──────────────────────────────────┐
│  Удалить аккаунт             [X] │
│──────────────────────────────────│
│                                  │
│  Вы уверены, что хотите удалить  │
│  аккаунт @username?             │
│                                  │
│          [Отмена] [Удалить]      │
└──────────────────────────────────┘
```

**Props & Emits:**
```typescript
interface Props {
  account: InstagramAccount  // аккаунт для удаления (нужен id и login для отображения)
}

defineEmits<{
  (e: 'deleted'): void  // аккаунт успешно удалён → обновить таблицу
}>()
```

**Логика:**
1. Отобразить логин аккаунта в тексте подтверждения
2. Кнопка «Удалить» → `store.deleteAccount.execute(props.account.id)`
3. При **успехе**:
   - `Notify.create({ type: 'positive', message: 'Аккаунт удалён' })`
   - Emit `'deleted'`
   - Закрыть модалку
4. При **ошибке**:
   - `Notify.create({ type: 'negative', message: store.deleteAccount.error })`

**Кнопка «Удалить»** — красного цвета (`color="negative"`).

**index.ts:**
```typescript
export { default as DeleteInstagramAccountModal } from './ui/DeleteInstagramAccountModal.vue'
```

---

### 6.3. `features/view-instagram-account/`

**Файл:** `ui/ViewInstagramAccountModal.vue`

**Что делает:** Модалка с детальной информацией об аккаунте (аватарка, имя, подписчики, подписки).

**Структура:**
```
┌──────────────────────────────────┐
│  Информация об аккаунте      [X] │
│──────────────────────────────────│
│                                  │
│       [  Аватарка 80px  ]        │
│       Full Name                  │
│       @instagram_login           │
│                                  │
│   Подписчики: 1234               │
│   Подписки:   567                │
│                                  │
│               [Закрыть]          │
└──────────────────────────────────┘
```

**Props:**
```typescript
interface Props {
  accountId: number  // ID аккаунта для загрузки деталей
}
```

**Логика:**
1. При открытии модалки → `store.fetchAccountDetails.execute(props.accountId)`
2. Пока загрузка → `QSpinner` внутри модалки
3. Отобразить: аватарку (или заглушку `QIcon account_circle`), `full_name`, `@instagram_login`, `followers_count`, `following_count`
4. Можно переиспользовать `ProfileCard.vue` из `entities/instagram-account/ui/` или расширить его

**index.ts:**
```typescript
export { default as ViewInstagramAccountModal } from './ui/ViewInstagramAccountModal.vue'
```

---

## 7. Frontend — Widget

### 7.1. `widgets/instagram-accounts-list/`

**Файл:** `ui/InstagramAccountsList.vue`

**Что делает:** Таблица аккаунтов с кнопкой «Добавить» сверху и действиями в каждой строке.

**Структура:**
```
┌──────────────────────────────────────────────────────┐
│                              [+ Добавить аккаунт]    │
│──────────────────────────────────────────────────────│
│  Логин          │  Добавлен        │  Действия       │
│─────────────────│──────────────────│─────────────────│
│  @user1         │  09.03.2026      │  [👁] [🗑]      │
│  @user2         │  08.03.2026      │  [👁] [🗑]      │
│  @user3         │  07.03.2026      │  [👁] [🗑]      │
│──────────────────────────────────────────────────────│
│  Показано 3 из 3                                     │
└──────────────────────────────────────────────────────┘
```

**Используемые компоненты Quasar:**
- `QTable` — таблица (columns + rows)
- `QBtn` (через `ButtonComponent`) — кнопки действий и «Добавить аккаунт»

**Столбцы QTable:**
```typescript
const columns: QTableColumn[] = [
  {
    name: 'instagram_login',
    label: 'Логин',
    field: 'instagram_login',
    align: 'left',
    sortable: true,
  },
  {
    name: 'created_at',
    label: 'Добавлен',
    field: 'created_at',
    align: 'left',
    sortable: true,
    format: (val: string) => new Date(val).toLocaleDateString('ru-RU'),
  },
  {
    name: 'actions',
    label: 'Действия',
    field: 'actions',
    align: 'center',
  },
]
```

**Действия в столбце «Действия» (через `#body-cell-actions` слот QTable):**
- Кнопка «Просмотр» — иконка `info` / `visibility`, открывает `ViewInstagramAccountModal`
- Кнопка «Удалить» — иконка `delete`, цвет `negative`, открывает `DeleteInstagramAccountModal`

**Состояние модалок:**
```typescript
const showAddModal = ref(false)
const showDeleteModal = ref(false)
const showViewModal = ref(false)
const selectedAccount = ref<Nullable<InstagramAccount>>(null)
```

**Логика:**
1. При монтировании → `store.fetchAccounts.execute()`
2. Данные таблицы: `store.fetchAccounts.data?.data ?? []`
3. Loading: `store.fetchAccounts.loading`
4. Кнопка «Добавить» → `showAddModal = true`
5. При `@added` от AddModal → `store.fetchAccounts.execute()` (перезагрузить таблицу)
6. При `@deleted` от DeleteModal → `store.fetchAccounts.execute()` (перезагрузить таблицу)
7. Пустое состояние: «Нет аккаунтов» с предложением добавить

**index.ts:**
```typescript
export { default as InstagramAccountsList } from './ui/InstagramAccountsList.vue'
```

---

## 8. Frontend — Page

### 8.1. `pages/instagram-accounts/`

**Файл:** `ui/InstagramAccountsPage.vue`

**Что делает:** Обёртка-страница, рендерит виджет `InstagramAccountsList`.

```vue
<script setup lang="ts">
  import { InstagramAccountsList } from 'src/widgets/instagram-accounts-list'
</script>

<template>
  <q-page padding>
    <InstagramAccountsList />
  </q-page>
</template>
```

**index.ts:**
```typescript
export { default as InstagramAccountsPage } from './ui/InstagramAccountsPage.vue'
```

---

## 9. Router — обновление

### 9.1. Обновить `router/routes.ts`

```typescript
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        component: () => import('src/pages/instagram-accounts/ui/InstagramAccountsPage.vue'),
      },
    ],
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
```

---

## 10. Обработка ошибок и уведомления

### Сценарии ошибок

| Сценарий | Источник | HTTP код | Сообщение |
|----------|----------|----------|-----------|
| Дубликат логина | Laravel validation | 422 | «Аккаунт с таким логином уже существует» |
| Неверный пароль Instagram | Python → Laravel | 400 | «Неверный логин или пароль Instagram» |
| Instagram недоступен | Python → Laravel | 502 | «Не удалось подключиться к Instagram» |
| Аккаунт не найден | Laravel | 404 | «Аккаунт не найден» |
| Сеть недоступна | Axios | — | «Ошибка сети» |

### Quasar Notify

Использовать `Notify` из `quasar` (не нужно оборачивать в shared/ui):
```typescript
import { Notify } from 'quasar'

// Успех
Notify.create({ type: 'positive', message: '...', position: 'top-right' })

// Ошибка
Notify.create({ type: 'negative', message: '...', position: 'top-right' })
```

> **Важно:** Плагин `Notify` должен быть включён в `quasar.config.ts` → `framework.plugins: ['Notify']`. Проверить, что он есть.

---

## 11. Порядок реализации

### Шаг 1 — Backend/
1. Добавить метод `findById()` в `RepositoryInterface` и `Repository`
2. Добавить метод `show()` в контроллер
3. Добавить метод `destroy()` в контроллер
4. Добавить роуты `GET /{id}` и `DELETE /{id}`
5. Добавить `unique` валидацию в `login()`
6. Обернуть ошибки валидации в стандартный формат `{ success: false, error: '...' }`

### Шаг 2 — Frontend: Entity
1. Обновить `types.ts` (добавить поля, переименовать типы)
2. Обновить `accountStore.ts` (добавить actions)

### Шаг 3 — Frontend: shared/api
1. Обновить `useApi.ts` (добавить `error` ref)

### Шаг 4 — Frontend: Features
1. Создать `features/add-instagram-account/` (модалка + index.ts)
2. Создать `features/delete-instagram-account/` (модалка + index.ts)
3. Создать `features/view-instagram-account/` (модалка + index.ts)

### Шаг 5 — Frontend: Widget
1. Создать `widgets/instagram-accounts-list/` (таблица + index.ts)

### Шаг 6 — Frontend: Page + Router
1. Создать `pages/instagram-accounts/` (страница + index.ts)
2. Обновить `router/routes.ts`
3. Удалить `pages/login/`

### Шаг 7 — Проверка
1. Проверить `Notify` плагин в `quasar.config.ts`
2. Убрать пустые legacy-папки (`components/`, `composables/`, `models/`, `types/`)
3. Проверить, что нет broken импортов на LoginPage
