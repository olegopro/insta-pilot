# Frontend Stores & FSD — Ревью и рекомендации

Полный аудит 9 Pinia stores, DTO, composables и их расположения в Feature-Sliced Design.
Все рекомендации отсортированы по приоритету: критические → мелкие.

---

## 1. КРИТИЧЕСКОЕ: `shared` → `entities` (нарушение FSD)

**Проблема:** Три файла в `shared/ui/` импортируют из `entities/media-post`:

```
shared/ui/media-card/MediaCard.vue          → import type { MediaPost } from '@/entities/media-post'
shared/ui/media-display/MediaDisplay.vue    → import { MEDIA_TYPE } from '@/entities/media-post'
                                                    import type { MediaPost } from '@/entities/media-post'
shared/ui/media-display/useMediaStyle.ts   → import { MEDIA_TYPE } from '@/entities/media-post'
                                                    import type { MediaPost } from '@/entities/media-post'
```

В FSD `shared` — нижний слой, он **не может** зависеть от `entities`. Обратное направление зависимости ломает переиспользуемость и смысл слоёв.

**Что делать:**

Переместить оба компонента (и зависимые composables) из `shared/ui/` в `entities/media-post/ui/`:

```bash
git mv frontend-vue/src/shared/ui/media-card frontend-vue/src/entities/media-post/ui/media-card
git mv frontend-vue/src/shared/ui/media-display frontend-vue/src/entities/media-post/ui/media-display
```

После перемещения обновить импорты в 3 файлах-потребителях:

| Файл | Было | Стать |
|------|-------|-------|
| `pages/feed/ui/FeedPage.vue:15` | `@/shared/ui/media-card` | `@/entities/media-post/ui/media-card` |
| `pages/search/ui/SearchPage.vue:16` | `@/shared/ui/media-card` | `@/entities/media-post/ui/media-card` |
| `features/post-detail/ui/PostDetailModal.vue:9` | `@/shared/ui/media-display` | `@/entities/media-post/ui/media-display` |

Также обновить импорт внутри `MediaDisplay.vue` (строки 8-9):

```diff
- import { useMediaStyle } from '@/shared/ui/media-display/useMediaStyle'
- import { useSwiperCarousel } from '@/shared/ui/media-display/useSwiperCarousel'
+ import { useMediaStyle } from '@/entities/media-post/ui/media-display/useMediaStyle'
+ import { useSwiperCarousel } from '@/entities/media-post/ui/media-display/useSwiperCarousel'
```

Обновить `media-card/__tests__/MediaCard.spec.ts` (строка 3):

```diff
- import MediaCard from '@/shared/ui/media-card/MediaCard.vue'
+ import MediaCard from '@/entities/media-post/ui/media-card/MediaCard.vue'
```

Обновить barrel-экспорт `entities/media-post/index.ts`:

```ts
export { default as MediaCard } from './ui/media-card'
export { default as MediaDisplay } from './ui/media-display'
```

Тогда потребители будут писать просто:

```ts
import { MediaCard, MediaDisplay } from '@/entities/media-post'
```

**Почему это безопасно:** MediaCard и MediaDisplay привязаны к типу `MediaPost` и константе `MEDIA_TYPE`. Они не являются generic-компонентами. Их естественное место — UI-сегмент entity.

---

## 2. Шаблонный boilerplate: `.then((response) => response.data)` ×36

**Проблема:** Каждое определение `useApi` заканчивается `.then((response) => response.data)` — это повторяется 36 раз по всему кодовой базе. Это визуальный шум, который маскирует реальную логику запроса.

**Пример (accountStore.ts, строки 16-17):**
```ts
const fetchAccountsApi = useApi<ApiResponseWrapper<InstagramAccountApi[]>>(
  () => api.get('/accounts/').then((response) => response.data)
)
```

**Что делать:** Создать хелпер в `shared/api/`, который оборачивает `api` и автоматически извлекает `response.data`:

```ts
// shared/api/apiData.ts
export const apiData = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    api.get<ApiResponseWrapper<T>>(url, config).then((response) => response.data),

  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.post<ApiResponseWrapper<T>>(url, data, config).then((response) => response.data),

  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.patch<ApiResponseWrapper<T>>(url, data, config).then((response) => response.data),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    api.delete<ApiResponseWrapper<T>>(url, config).then((response) => response.data)
}
```

Тогда каждое определение `useApi` упрощается:

```ts
// было:
const fetchAccountsApi = useApi<ApiResponseWrapper<InstagramAccountApi[]>>(
  () => api.get('/accounts/').then((response) => response.data)
)

// стало:
const fetchAccountsApi = useApi<ApiResponseWrapper<InstagramAccountApi[]>>(
  () => apiData.get('/accounts/')
)
```

Для запросов с `signal` — хелпер пробрасывает его через `config`:

```ts
const fetchFeedApi = useApi<ApiResponseWrapper<FeedResponseApi>, { accountId: number }>(
  ({ accountId }, signal) => apiData.get(`/feed/${String(accountId)}`, { signal })
)
```

**Затронутые файлы:** все 9 stores (36 мест).

**Почему это улучшение:** убирает дублирование, сокращает каждый `useApi`-вызов на одну строку, делает фокус на endpoint-е и параметрах, а не на `response.data`.

---

## 3. `searchStore` — дублирование логики hashtag/location

**Проблема:** `searchHashtag` и `fetchLocationMedias` делают почти одно и то же — сбрасывают результаты, вызывают API, маппят ответ. `loadMoreHashtag` и `loadMoreLocationMedias` тоже идентичны. Та же история с API-обёртками: `searchHashtagApi`/`fetchLocationMediasApi` и `loadMoreHashtagApi`/`loadMoreLocationMediasApi` отличаются только URL (`/search/hashtag` vs `/search/location`) и ключами параметров.

```ts
// searchHashtag (строки 69-77):
searchResults.value = []
searchCursor.value = null
const { data } = await searchHashtagApi.execute(...)
searchResults.value = mediaPostDTO.toLocal(data.items)
searchCursor.value = data.next_max_id ?? null

// fetchLocationMedias (строки 92-100):
searchResults.value = []
searchCursor.value = null
const { data } = await fetchLocationMediasApi.execute(...)
searchResults.value = mediaPostDTO.toLocal(data.items)
searchCursor.value = data.next_max_id ?? null
```

**Что делать:** Вынести общую логику в приватные хелперы внутри store:

```ts
const clearResults = () => {
  searchResults.value = []
  searchCursor.value = null
}

const setResults = (data: SearchResponseApi) => {
  searchResults.value = mediaPostDTO.toLocal(data.items)
  searchCursor.value = data.next_max_id ?? null
}

const appendResults = (data: SearchResponseApi) => {
  searchResults.value = [...searchResults.value, ...mediaPostDTO.toLocal(data.items)]
  searchCursor.value = data.next_max_id ?? null
}
```

Тогда actions станут короче и без дублирования:

```ts
const searchHashtag = async (accountId: number, tag: string, amount?: number) => {
  lastHashtag.value = tag
  lastLocation.value = null
  clearResults()
  const { data } = await searchHashtagApi.execute({ accountId, tag, ...(amount ? { amount } : {}) })
  setResults(data)
}
```

`loadMoreHashtag` и `loadMoreLocationMedias` сводятся к 3-4 строкам каждый через `appendResults`.

---

## 4. `feedStore` — распространённый паттерн `...(value ? { key: value } : {})`

**Проблема:** В `feedStore.ts` паттерн `...(value ? { key: value } : {})` повторяется 9 раз (строки 27-28, 53-54, 74-75, 76, 93-94). То же в `activityLogStore.ts` (строки 51, 64) и `searchStore.ts` (строки 20, 44, 74, 97).

```ts
// примеры:
...(reason ? { reason } : {}),
...(minPosts ? { min_posts: minPosts } : {}),
...(maxId ? { maxId } : {}),
...(filters ? { filters } : {}),
```

**Что делать:** Утилитарная функция в `shared/lib/`:

```ts
export const optional = <T>(value: T | undefined | null): {} | Record<string, T> =>
  value !== undefined && value !== null ? { value } : {}
```

Применение:

```ts
params: {
  per_page: 50,
  ...optional(beforeId && { before_id: beforeId }),
  ...optional(afterId && { after_id: afterId })
}
```

Или даже simpler — просто условное spreading через `&&`:

```ts
params: {
  per_page: 50,
  ...(beforeId && { before_id: beforeId }),
  ...(afterId && { after_id: afterId })
}
```

Это уже работает в JS/TS без утилиты — просто стилистическая замена длинного тернарника. Согласуется с проектным правилом «`&&` вместо `if` для коротких условных вызовов».

---

## 5. Семантика: `sendComment` в `searchStore`

`features/post-detail/ui/PostDetailModal.vue` (строка 4) использует `useSearchStore` для вызова `sendComment`. Модалка поста семантически не связана с поиском — это создаёт неочевидную связанность. Если кто-то читает `PostDetailModal`, он видит `useSearchStore` и может подумать, что модалка связана с поиском.

**Что делать (опционально):** Перенести `sendComment` action из `searchStore` в `commentStore`. Логичнее, так как `commentStore` уже отвечает за работу с комментариями.

---

## 6. `commentStore.fetchReplies` — ручное управление loading-флагом

**Проблема:** `fetchReplies` (строки 60-73) вручную ставит/снимает `comment.childCommentsLoading = true/false` через `try/finally`, при этом `useApi` уже имеет своё собственное `loading`-состояние. Это дублирование ответственности.

```ts
comment.childCommentsLoading = true
try {
  const { data } = await fetchRepliesApi.execute({ accountId, mediaPk, commentPk })
  comment.childComments = mediaPostDTO.toLocalComments(data.child_comments)
  comment.childCommentsCursor = data.next_min_id
} catch (e) {
  if (!isCancel(e)) throw e
} finally {
  comment.childCommentsLoading = false
}
```

**Почему это так:** `useApi` отслеживает loading глобально для всего экземпляра, а здесь нужен per-comment loading. Это обоснованный компромисс, но стоит документировать через JSDoc-комментарий, почему loading управляется вручную.

---

## 7. `fetchLocations` в `searchStore` — лишний сброс

**Проблема:** В `fetchLocations` (строки 86-90) `locations.value = []` стоит перед `await`, а затем сразу перезаписывается результатом:

```ts
const fetchLocations = async (accountId: number, query: string) => {
  locations.value = []          // ← сброс
  const { data } = await fetchLocationsApi.execute({ accountId, query })
  locations.value = data.locations  // ← перезапись
}
```

Если API-запрос упадёт — `locations` останется пустым, что корректно. Но если consumer не подписан на `locationsLoading`, он не увидит состояние «грузятся ли ещё локации». Это не баг, но стоит быть внимательным.

---

## 8. Несогласованные barrel-импорты у `instagram-account`

6 файлов импортируют напрямую из `model/`, минуя barrel `@/entities/instagram-account`:

| Файл | Строка |
|------|--------|
| `features/add-instagram-account/ui/AddInstagramAccountModal.vue` | 3: `from '@/entities/instagram-account/model/accountStore'` |
| `features/delete-instagram-account/ui/DeleteInstagramAccountModal.vue` | 2: `from '@/entities/instagram-account/model/accountStore'` |
| `features/view-instagram-account/ui/ViewInstagramAccountModal.vue` | 3: `from '@/entities/instagram-account/model/accountStore'` |
| `entities/instagram-account/ui/AccountSelectComponent.vue` | 3: `from '@/entities/instagram-account/model/accountStore'` |
| `pages/instagram-accounts/ui/InstagramAccountsPage.vue` | 3-7: `from '@/entities/instagram-account/model/...'` |
| `pages/search/ui/SearchPage.vue` | 4-5: `from '@/entities/instagram-account/model/...'` |

При этом barrel уже экспортирует `useAccountStore` и `useAccountSelect`.
Все остальные entity (activity-log, media-post, user, llm-settings) потребляются через barrel.

**Что делать:** Заменить прямые импорты на barrel. Дополнительно добавить в barrel недостающие экспорты (`instagramAccountTableColumns`, `instagramAccountListDTO`).

---

## 9. `entities/user/index.ts` — абсолютный путь в re-export

Все остальные entity используют относительные пути в barrel, а `user` — абсолютный:

```ts
// сейчас (entities/user/index.ts):
export { useAuthStore } from '@/entities/user/model/authStore'
export { useAdminUsersStore } from '@/entities/user/model/adminUsersStore'

// должно быть:
export { useAuthStore } from './model/authStore'
export { useAdminUsersStore } from './model/adminUsersStore'
export type { User, Role, LoginRequest, AuthResponse } from './model/types'
export type { UserApi, RoleApi, AuthResponseApi } from './model/apiTypes'
```

---

## 10. Barrel-экспорты `entities/user` — вытекают внутренние типы

`entities/user/index.ts` экспортирует `UserApi`, `RoleApi`, `AuthResponseApi` (суффикс `Api`). По конвенции проекта типы с суффиксом `Api` — внутренние для entity, они нужны только DTO. Наружу entity должна отдавать локальные типы (`User`, `Role`, `AuthResponse`), а `*Api` — потреблять только внутри `model/`.

Сейчас `UserApi` импортируется только внутри `model/` (stores, DTO, тесты), но exposing через barrel создаёт соблазн импортировать его снаружи.

**Что делать:** убрать `UserApi`, `RoleApi`, `AuthResponseApi` из barrel. По аналогии — проверить `ActivityLogApi`, `ActivityLogsResponseApi` в barrel `activity-log` (они тоже могут быть лишними снаружи).

---

## 11. DTO-паттерн: `class` + `new` vs функции

**Проблема:** Все DTO реализованы как class с single-instance export (`export default new SomeDTO()`). Но ни один DTO не хранит состояние — это чистые функции маппинга. Class-обёртка не добавляет ничего, кроме `this`-контекста.

```ts
class InstagramAccountDTO {
  toLocal(data: InstagramAccountApi): InstagramAccount { ... }
  toLocalList(data: InstagramAccountApi[]): InstagramAccount[] {
    return data.map((item) => this.toLocal(item))
  }
}
export default new InstagramAccountDTO()
```

**Альтернатива (не рекомендация, а наблюдение):** Можно переписать как набор plain functions (`toLocalAccount`, `toLocalAccountList`). Но текущий паттерн тоже работает и соответствует CLAUDE.md. Это не баг, просто момент для осознания.

---

## 12. Чисто — без замечаний

- **Все 9 stores** находятся в `entities/*/model/` — правильно по FSD
- **Паттерн store** (приватный `*Api`, публичный `ref`/`computed`/actions, `*Api` не в `return`) — соблюдён на 100%
- **Направления импортов** от consumers к stores — строго вверх по иерархии, без нарушений (кроме п.1)
- **Циклических зависимостей** нет
- **Composables в features** (`useCommentGeneration`, `useActivityLive`, `useGlobalActivityLive`) корректно не являются Pinia stores
- **`sidebarActivityStore`** работает с localStorage без `useApi` — корректно
- **`authStore`** использует `shallowRef` для `user` — корректная оптимизация
- **`llmSettingsStore`** делает `await fetchAll()` после мутаций — корректно для синхронизации
- **`useFeedCache`** не является Pinia store — это helper composable с localStorage, корректно
- **`useAccountSelect`** — composable, оборачивающий `useAccountStore` + localStorage, корректно размещён внутри entity

---

## Сводная таблица

| # | Задача | Приоритет | Риск | Сложность |
|---|--------|-----------|------|-----------|
| 1 | Переместить `media-card` + `media-display` из `shared/ui` в `entities/media-post/ui` | **Высокий** | Низкий | Низкая |
| 2 | Хелпер `apiData` для устранения `.then((response) => response.data)` ×36 | **Средний** | Низкий | Средняя |
| 3 | Дедупликация логики в `searchStore` (hashtag/location) | **Средний** | Низкий | Низкая |
| 4 | Замена `...(x ? { x } : {})` на `...(x && { x })` | Низкий | Нулевой | Тривиальная |
| 5 | Перенести `sendComment` из `searchStore` в `commentStore` | Низкий | Низкий | Низкая |
| 6 | JSDoc к ручному `childCommentsLoading` в `commentStore.fetchReplies` | Низкий | Нулевой | Тривиальная |
| 7 | barrel `instagram-account`: унифицировать импорты (6 файлов) | Низкий | Минимальный | Тривиальная |
| 8 | barrel `user/index.ts`: относительные пути | Низкий | Нулевой | Тривиальная |
| 9 | barrel `user/index.ts`: убрать `*Api` типы из публичного API | Низкий | Нулевой | Тривиальная |
