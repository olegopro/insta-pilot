<div align="center">

# 📦 Паттерн Pinia store через `useApi`

<img src="https://img.shields.io/badge/Pinia-FFD93D?style=for-the-badge&logo=pinia&logoColor=black" />
<img src="https://img.shields.io/badge/Vue_3-42b883?style=for-the-badge&logo=vue.js&logoColor=white" />
<img src="https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Composables-42b883?style=for-the-badge&logo=vue.js&logoColor=white" />
<img src="https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white" />

</div>

<br />

> Императивный паттерн без скрытого состояния. Каждый action в store работает через
> один композабл `useApi` — единственная точка для loading / error / data.
> Никакого «магического реактивного состояния», которое непонятно когда меняется.

<br />

---

## 🎯 Зачем это нужно

В крупном SPA каждый action должен:

🔴 управлять состоянием loading (отрисовать спиннер)
🔴 управлять состоянием error (показать toast)
🔴 типизировать ответ API (snake_case → camelCase)
🔴 обрабатывать race conditions (быстрые повторные клики)

Если повторять boilerplate в каждом store — это сотни лишних строк и место для багов.

**Решение** — один композабл `useApi`, который инкапсулирует всё это.

---

## 🧩 Архитектура

```
┌──────────────────────────────────────────────────────────────┐
│                     Vue Component                            │
│   store.fetchAccounts()                                      │
│   v-if="store.fetchAccountsLoading" → Spinner                │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                  Pinia Store (entity)                        │
│                                                              │
│   ПРИВАТНО (не в return). :                                  │
│   const fetchAccountsApi = useApi(...)                       │
│                                                              │
│   ПУБЛИЧНО (в return). :                                     │
│   const accounts = ref<InstagramAccount[]>([])               │
│   const fetchAccounts = async () => {                        │
│       const { data } = await fetchAccountsApi.execute()      │
│       accounts.value = data                                  │
│   }                                                          │
│   const fetchAccountsLoading = computed(                     │
│       () => fetchAccountsApi.loading.value                   │
│   )                                                          │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│              useApi composable (shared/api)                  │
│                                                              │
│   • execute(...args) → Promise<TData>                        │
│   • loading: Ref<boolean>                                    │
│   • error: Ref<Error | null>                                 │
│   • response: Ref<ApiResponse<TData> | null>                 │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│         axios instance + DTO transform (snake → camel)       │
└──────────────────────────────────────────────────────────────┘
```

---

## 📁 Ключевые файлы

| Файл                                                                                                                  | Что делает                                |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [`shared/api/useApi.ts`](../frontend-vue/src/shared/api/useApi.ts)                                                    | Композабл, ядро паттерна                  |
| [`shared/api/types.ts`](../frontend-vue/src/shared/api/types.ts)                                                      | `ApiResponse<T>`, `ApiError`              |
| [`entities/instagram-account/model/accountStore.ts`](../frontend-vue/src/entities/instagram-account/model/accountStore.ts) | Эталонный пример store                    |
| [`entities/instagram-account/model/instagramAccountDTO.ts`](../frontend-vue/src/entities/instagram-account/model/instagramAccountDTO.ts) | snake_case → camelCase                    |

---

## 📐 Правила паттерна

### 1. `*Api`-объекты — приватные

```ts
// ❌ НЕЛЬЗЯ — утечка реализации
return { fetchAccountsApi, accounts }

// ✅ МОЖНО — только публичный фасад
return { accounts, fetchAccounts, fetchAccountsLoading }
```

### 2. Данные хранятся в `ref`, не в `computed`

```ts
// ❌ Неправильно — данные привязаны к жизни запроса
const accounts = computed(() => fetchAccountsApi.response.value?.data ?? [])

// ✅ Правильно — независимый источник истины
const accounts = ref<InstagramAccount[]>([])
const fetchAccounts = async () => {
    const { data } = await fetchAccountsApi.execute()
    accounts.value = data
}
```

### 3. Императивные actions — `await execute()` бросает на ошибке

```ts
// ❌ Лишняя проверка — ошибки уже обработаны через throw
const { data } = await fetchAccountsApi.execute()
if (!data) return  // ← никогда не выполнится

// ✅ Чисто и читаемо
const { data } = await fetchAccountsApi.execute()
accounts.value = data
```

### 4. Fire-and-forget для side effects

```ts
// Если action не работает с ответом — не нужно await
const deleteAccount = (id: number) => deleteAccountApi.execute(id)
const deleteAccountLoading = computed(() => deleteAccountApi.loading.value)
const deleteAccountError = computed(() => deleteAccountApi.error.value)
```

---

## ⚙️ Полный пример store

```ts
export const useAccountStore = defineStore('account', () => {
    // ── приватно ──────────────────────────────────────
    const fetchAccountsApi = useApi<InstagramAccountApi[]>(
        'instagram-accounts',
        'GET'
    )
    const deleteAccountApi = useApi<void>('instagram-accounts', 'DELETE')

    // ── публично: данные ──────────────────────────────
    const accounts = ref<InstagramAccount[]>([])

    // ── публично: actions ─────────────────────────────
    const fetchAccounts = async () => {
        const { data } = await fetchAccountsApi.execute()
        accounts.value = instagramAccountListDTO.toLocal(data)
    }

    const deleteAccount = (id: number) => deleteAccountApi.execute(id)

    // ── публично: состояния (computed-обёртки) ────────
    const fetchAccountsLoading = computed(() => fetchAccountsApi.loading.value)
    const deleteAccountLoading = computed(() => deleteAccountApi.loading.value)
    const deleteAccountError    = computed(() => deleteAccountApi.error.value)

    return {
        accounts,
        fetchAccounts,
        fetchAccountsLoading,
        deleteAccount,
        deleteAccountLoading,
        deleteAccountError
    }
})
```

---

## 💡 Почему именно так

| Решение                                | Альтернатива                      | Почему именно это                                            |
| -------------------------------------- | --------------------------------- | ------------------------------------------------------------ |
| Один `useApi` на каждый эндпоинт       | Один глобальный `apiClient`       | Изолированные `loading`/`error` для каждого вызова           |
| Императивные actions                   | Реактивные computed-обёртки       | Понятный момент, когда данные обновляются                    |
| Приватные `*Api` объекты               | Открытые в return                 | Запрет на прямое обращение к внутренней реализации           |
| `ref` для данных                       | `computed(() => api.response)`    | Данные живут отдельно от текущего запроса                    |
| DTO в actions                          | DTO в API-слое                    | Store знает свою доменную модель, API остаётся универсальным |
| `throw` в `execute`                    | `try/catch` в каждом action       | Меньше boilerplate, ошибка обрабатывается централизованно    |

---

## 🎁 Что это даёт

✅ **Одинаковый API в компонентах** — `store.someActionLoading`, `store.someActionError`
✅ **End-to-end типизация** — от axios до template
✅ **Легко тестировать** — `useApi` мокается одной строкой
✅ **Легко читать** — структура каждого store предсказуема
✅ **Невозможно забыть `loading`** — он всегда есть «бесплатно»

---

<div align="center">

← [Вернуться к README](../README.md)

</div>
