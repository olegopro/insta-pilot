# insta-pilot — Frontend Plan (Vue 3 + Quasar + TypeScript, FSD)

> Детальный план frontend. Основной план: [PLAN.md](PLAN.md)

---

## Фаза 1 — Авторизация и пользователи

### 1.1 Новые файлы

```
entities/
  user/
    model/
      types.ts                  # User, LoginRequest, RegisterRequest, AuthResponse
      authStore.ts              # Pinia: login, logout, me, token
    index.ts

features/
  auth-login/
    ui/LoginForm.vue            # Форма email + password
    index.ts
  toggle-user-active/
    ui/ToggleUserActiveButton.vue
    index.ts
  change-user-role/
    ui/ChangeUserRoleSelect.vue
    index.ts

widgets/
  users-list/
    ui/UsersList.vue            # Таблица пользователей (admin)
    index.ts

pages/
  login/
    ui/LoginPage.vue
    index.ts
  admin-users/
    ui/AdminUsersPage.vue
    index.ts
```

### 1.2 entities/user

**types.ts:**
```typescript
export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'user'
  is_active: boolean
  accounts_count?: number
  created_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
  password_confirmation: string
}

export interface AuthResponse {
  user: User
  token: string
}
```

**authStore.ts:**
```
Actions (каждый через useApi):
  - login(LoginRequest)    → POST /api/auth/login → сохранить token в localStorage
  - logout()               → POST /api/auth/logout → очистить token
  - fetchMe()              → GET /api/auth/me → обновить user

Computed:
  - user        → из последнего fetchMe
  - isAdmin     → user?.role === 'admin'
  - isAuthenticated → !!token

Token:
  - Хранить в localStorage('auth_token')
  - При инициализации store → проверить localStorage
  - При logout → удалить из localStorage
```

### 1.3 Axios: auth interceptor

**boot/axios.ts** (обновить):
```
Request interceptor:
  → если есть token в localStorage → добавить Authorization: Bearer {token}

Response interceptor:
  → если 401 → очистить token, redirect на /login
  → если 403 "Аккаунт деактивирован" → notify + redirect на /login
```

### 1.4 Router

**Новые роуты:**
```
/login           → LoginPage         (meta: { guest: true })
/accounts        → InstagramAccountsPage (meta: { auth: true })
/admin/users     → AdminUsersPage    (meta: { auth: true, role: 'admin' })
```

**Guards (beforeEach):**
```
1. meta.auth && нет token → redirect /login
2. meta.role && роль не совпадает → redirect /accounts
3. meta.guest && есть token → redirect /accounts
```

> Роль берём из authStore (fetchMe при старте приложения).

### 1.5 LoginPage

```
┌──────────────────────────────────┐
│         insta-pilot              │
│──────────────────────────────────│
│                                  │
│  Email:                          │
│  [________________________]      │
│                                  │
│  Пароль:                         │
│  [________________________]  👁  │
│                                  │
│           [Войти]                │
│                                  │
└──────────────────────────────────┘
```

- Использовать InputComponent (email + password)
- ButtonComponent (Войти)
- При успехе → redirect на /accounts
- При ошибке → Notify

### 1.6 AdminUsersPage

```
┌──────────────────────────────────────────────────────────────┐
│  Пользователи                                                │
│──────────────────────────────────────────────────────────────│
│  Имя       │ Email           │ Роль    │ Аккаунтов │ Активен │
│────────────│─────────────────│─────────│───────────│─────────│
│  Admin     │ admin@...       │ [admin] │     3     │  [✅]   │
│  User 1    │ user1@...       │ [user▼] │     1     │  [✅]   │
│  User 2    │ user2@...       │ [user▼] │     0     │  [❌]   │
│──────────────────────────────────────────────────────────────│
│  Показано 3 из 3                                             │
└──────────────────────────────────────────────────────────────┘
```

- QTable с колонками: name, email, role (QSelect inline), accounts_count, is_active (toggle)
- Роль: QSelect (admin/user) → PATCH /api/admin/users/{id}/role
- Активен: QToggle → PATCH /api/admin/users/{id}/toggle
- Нельзя деактивировать/менять роль самому себе (disabled)

### 1.7 MainLayout — навигация

Боковое меню (QDrawer) или верхнее (QToolbar) с пунктами:

| Пункт | Роут | Видимость |
|-------|------|-----------|
| Аккаунты | `/accounts` | всем |
| Лента | `/feed` | всем (Фаза 2) |
| Поиск | `/search` | всем (Фаза 3) |
| Настройки LLM | `/settings/llm` | admin (Фаза 4) |
| Пользователи | `/admin/users` | admin |
| Выход | — | всем (→ logout → /login) |

### 1.8 Порядок реализации

1. entities/user (types.ts + authStore.ts + index.ts)
2. boot/axios.ts (interceptors)
3. features/auth-login (LoginForm)
4. pages/login (LoginPage)
5. router (guards + новые роуты)
6. MainLayout (навигация + logout + role-based visibility)
7. features/toggle-user-active + change-user-role
8. widgets/users-list (UsersList)
9. pages/admin-users (AdminUsersPage)

---

## Фаза 2 — Лента аккаунта

### 2.1 Новые файлы

```
shared/
  ui/
    masonry-grid/
      MasonryGrid.vue           # CSS column-count, адаптивный
      index.ts
    media-card/
      MediaCard.vue             # Thumbnail + hover overlay
      index.ts

entities/
  media-post/
    model/
      types.ts                  # MediaPost, MediaUser, InstagramUserDetail, MediaType
    index.ts

features/
  like-post/
    ui/LikePostButton.vue       # Иконка лайка (hover, toggle)
    index.ts
  view-post-detail/
    ui/PostDetailModal.vue      # Модалка: фото/видео + caption + stats
    index.ts
  view-instagram-user/
    ui/InstagramUserModal.vue   # Модалка: аватар + bio + counters
    index.ts

widgets/
  account-feed/
    ui/AccountFeed.vue          # MasonryGrid + QInfiniteScroll
    index.ts

pages/
  feed/
    ui/FeedPage.vue             # Выбор аккаунта + AccountFeed
    index.ts
```

### 2.2 entities/media-post

**types.ts:**
```typescript
import type { Nullable } from 'src/shared/lib'

export type MediaType = 1 | 2 | 8  // 1=Photo, 2=Video, 8=Album

export interface MediaUser {
  pk: string
  username: string
  full_name: string
  profile_pic_url: string
}

export interface MediaPost {
  pk: string
  media_type: MediaType
  thumbnail_url: string
  video_url: Nullable<string>
  caption_text: string
  like_count: number
  comment_count: number
  has_liked: boolean
  user: MediaUser
  taken_at: string
}

export interface InstagramUserDetail {
  pk: string
  username: string
  full_name: string
  profile_pic_url: string
  biography: string
  follower_count: number
  following_count: number
  media_count: number
  is_private: boolean
}
```

### 2.3 shared/ui/MasonryGrid

**Props:**
```typescript
interface Props {
  columns?: number   // default: 3
  gap?: string       // default: '16px'
}
```

**Реализация:** CSS `column-count` + `break-inside: avoid` на дочерних элементах.
Slot: default (элементы сетки).

```css
.masonry-grid {
  column-count: v-bind(columns);
  column-gap: v-bind(gap);
}
.masonry-grid > * {
  break-inside: avoid;
  margin-bottom: v-bind(gap);
}
```

### 2.4 shared/ui/MediaCard

**Props:**
```typescript
interface Props {
  post: MediaPost
}
```

**Events:**
```typescript
defineEmits<{
  (e: 'like'): void
  (e: 'click'): void
  (e: 'user-info'): void
}>()
```

**Визуал:**
```
┌────────────────────┐
│                    │
│    Thumbnail       │
│    (q-img)         │
│                    │
│  ┌──────────────┐  │  ← hover overlay (absolute, transition)
│  │  ❤️    ℹ️     │  │     ❤️ = лайк (красный если has_liked)
│  └──────────────┘  │     ℹ️ = открыть модалку поста
│                    │
└────────────────────┘
```

- Hover: overlay с opacity transition
- Иконки: q-icon `favorite` (лайк) + `info` (детали)
- Если `has_liked` → иконка красная всегда
- border-radius: 8px, cursor: pointer

### 2.5 feedStore (Pinia)

Разместить в `entities/media-post/model/feedStore.ts` или отдельно.

```
Actions (через useApi):
  fetchFeed(accountId, cursor?)   → GET /api/feed?account_id=...&cursor=...
  likePost(accountId, mediaPk)    → POST /api/media/{mediaPk}/like
  fetchUserInfo(accountId, userPk) → GET /api/instagram-user/{userPk}?account_id=...
```

### 2.6 FeedPage

```
┌──────────────────────────────────────────────────┐
│  Лента                    [Аккаунт: @user1 ▼]    │
│──────────────────────────────────────────────────│
│  ┌────┐  ┌────────┐  ┌────┐                      │
│  │    │  │        │  │    │                       │
│  │ 📷 │  │  📷    │  │ 📷 │  Masonry 3 cols       │
│  │    │  │        │  │    │                       │
│  └────┘  │        │  └────┘                       │
│  ┌────┐  └────────┘  ┌────────┐                   │
│  │ 📷 │  ┌────┐      │        │                   │
│  │    │  │ 📷 │      │  📷    │  QInfiniteScroll   │
│  └────┘  └────┘      └────────┘                   │
│           ⏳ Загрузка...                           │
└──────────────────────────────────────────────────┘
```

- Вверху: QSelect для выбора Instagram-аккаунта (из accountStore)
- При выборе → `feedStore.fetchFeed.execute({accountId})`
- QInfiniteScroll → подгрузка следующей страницы (cursor/next_max_id)
- Пустое состояние: "Выберите аккаунт" или "Лента пуста"
- Каждая карточка: MediaCard → events: like, click, user-info

### 2.7 PostDetailModal

```
┌──────────────────────────────────┐
│  @username                   [X] │
│──────────────────────────────────│
│                                  │
│     [  Фото/Видео (полный)  ]   │
│                                  │
│  caption text here...            │
│                                  │
│  ❤️ 1234    💬 56                 │
│                                  │
│              [Закрыть]           │
└──────────────────────────────────┘
```

- Props: `post: MediaPost`
- Фото: `q-img` (полный размер)
- Видео: `<video>` с controls (если media_type === 2)
- Автор: username сверху
- Caption + like_count + comment_count

### 2.8 InstagramUserModal

```
┌──────────────────────────────────┐
│  Профиль пользователя       [X] │
│──────────────────────────────────│
│                                  │
│       [  Аватарка 100px  ]       │
│       Full Name                  │
│       @username                  │
│                                  │
│   📝 Biography text...           │
│                                  │
│   👥 5000 подписчиков            │
│   👤 300 подписок                │
│   📷 150 публикаций              │
│                                  │
│              [Закрыть]           │
└──────────────────────────────────┘
```

- Props: `userPk: string, accountId: number`
- При открытии → `feedStore.fetchUserInfo.execute(accountId, userPk)`
- QSpinner пока загрузка

### 2.9 Порядок реализации

1. entities/media-post (types.ts + index.ts)
2. shared/ui/masonry-grid (MasonryGrid.vue + index.ts)
3. shared/ui/media-card (MediaCard.vue + index.ts)
4. feedStore (API actions)
5. features/like-post (LikePostButton)
6. features/view-post-detail (PostDetailModal)
7. features/view-instagram-user (InstagramUserModal)
8. widgets/account-feed (AccountFeed — MasonryGrid + scroll + modals)
9. pages/feed (FeedPage — select account + AccountFeed)
10. router: добавить `/feed`

---

## Фаза 3 — Поиск по тегам/гео

### 3.1 Новые файлы

```
features/
  search-content/
    ui/SearchControls.vue       # Toggle хэштег/гео + поле ввода
    index.ts
  send-comment/
    ui/CommentInput.vue         # Поле + кнопки "Сгенерировать" и "Отправить"
    index.ts

widgets/
  search-results/
    ui/SearchResults.vue        # MasonryGrid с результатами
    index.ts
  search-post-modal/
    ui/SearchPostModal.vue      # Модалка поста с комментарием
    index.ts

pages/
  search/
    ui/SearchPage.vue
    index.ts
```

### 3.2 SearchPage

```
┌────────────────────────────────────────────────────┐
│  Поиск           [Аккаунт: @user1 ▼]               │
│────────────────────────────────────────────────────│
│  [🏷 Хэштег] [📍 Геолокация]    ← toggle (взаимоискл.) │
│                                                    │
│  Хэштег: [________travel________] [🔍]             │
│────────────────────────────────────────────────────│
│  ┌────┐  ┌────────┐  ┌────┐                        │
│  │    │  │        │  │    │                         │
│  │ 📷 │  │  📷    │  │ 📷 │  Masonry 3 cols         │
│  │    │  │        │  │    │                         │
│  └────┘  │        │  └────┘                         │
│  ┌────┐  └────────┘  ┌────┐                         │
│  │ 📷 │  ┌────┐      │ 📷 │                         │
│  └────┘  │ 📷 │      └────┘                         │
│          └────┘                                     │
└────────────────────────────────────────────────────┘
```

### 3.3 Toggle: хэштег ↔ геолокация

- `QBtnToggle` с двумя опциями
- Состояние: `searchMode: ref<'hashtag' | 'location'>('hashtag')`
- При переключении → очистить результаты и поле ввода
- **Взаимоисключающие** — включение одного выключает другой

### 3.4 Поиск по хэштегу

1. InputComponent + кнопка поиска
2. При вводе → `searchStore.searchHashtag.execute({ accountId, hashtag })`
3. Результаты → MasonryGrid + MediaCard
4. Клик на карточку → SearchPostModal

### 3.5 Поиск по геолокации — двухшаговый

1. **Шаг 1:** InputComponent → `searchStore.searchLocations.execute({ query })` → QSelect dropdown со списком мест
2. **Шаг 2:** Выбрать место → `searchStore.searchLocation.execute({ locationPk })` → Masonry

Использовать QSelect с `use-input` + `@filter` для autocomplete по местам.

### 3.6 SearchPostModal

```
┌──────────────────────────────────────────────────┐
│  @username                                   [X] │
│──────────────────────────────────────────────────│
│                                                  │
│           [  Фото/Видео контент  ]               │
│                                                  │
│  ❤️ 1234 лайков   💬 56 комментариев              │
│                                                  │
│  Caption text here...                            │
│                                                  │
│──────────────────────────────────────────────────│
│  [Комментарий____________] [⚡ Сгенерировать] [📤] │
│                                                  │
│  ┌─ Статус генерации (Фаза 4) ───────────────┐  │
│  │ ✅ Загрузка изображения...                  │  │
│  │ ⏳ Анализ изображения...                    │  │
│  │ ○ Комментарий готов                         │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

- Props: `post: MediaPost, accountId: number`
- Вверху: @username автора
- Контент: q-img (фото) или video (видео)
- Статистика: like_count, comment_count
- Caption
- Footer: InputComponent (комментарий) + ButtonComponent (Сгенерировать) + ButtonComponent (Отправить)
- Блок статуса генерации — скрыт по умолчанию, показывается при нажатии "Сгенерировать" (→ Фаза 4)

**"Отправить":**
```
→ searchStore.sendComment.execute({ accountId, mediaPk, text })
→ Notify success / error
→ Очистить поле
```

**"Сгенерировать":**
- В Фазе 3 — кнопка есть, но disabled с tooltip "Настройте LLM"
- В Фазе 4 → полная интеграция с WebSocket

### 3.7 searchStore (Pinia)

```
Actions (через useApi):
  searchHashtag(accountId, hashtag, amount?)     → GET /api/search/hashtag
  searchLocations(accountId, query)              → GET /api/search/locations
  searchLocation(accountId, locationPk, amount?) → GET /api/search/location
  sendComment(accountId, mediaPk, text)          → POST /api/media/{mediaPk}/comment
```

### 3.8 Порядок реализации

1. searchStore (API actions)
2. features/search-content (SearchControls — toggle + input)
3. features/send-comment (CommentInput — поле + кнопки)
4. widgets/search-post-modal (SearchPostModal — модалка с комментарием)
5. widgets/search-results (SearchResults — Masonry с результатами)
6. pages/search (SearchPage — всё вместе)
7. router: добавить `/search`

---

## Фаза 4 — LLM интеграция

### 4.1 Новые файлы

```
entities/
  llm-settings/
    model/
      types.ts                    # LlmSettings, UpdateLlmSettingsRequest
      llmSettingsStore.ts
    index.ts

features/
  generate-comment/
    lib/useCommentGeneration.ts   # Composable: WebSocket + статус
    ui/GenerateCommentButton.vue  # Кнопка + trigger
    ui/GenerationStatusBlock.vue  # Блок статуса (timeline/stepper)
    index.ts

pages/
  llm-settings/
    ui/LlmSettingsPage.vue
    index.ts

shared/
  lib/
    useEcho.ts                    # Laravel Echo + Pusher init
```

### 4.2 entities/llm-settings

**types.ts:**
```typescript
export interface LlmSettings {
  id: number
  provider: string
  api_key_masked: string        // "sk-...abc" — backend маскирует
  model_name: string
  system_prompt: string
  tone: 'positive' | 'negative' | 'neutral'
}

export interface UpdateLlmSettingsRequest {
  provider: string
  api_key: string
  model_name: string
  system_prompt: string
  tone: string
}
```

**llmSettingsStore.ts:**
```
Actions (через useApi):
  fetchSettings()                        → GET /api/settings/llm
  updateSettings(UpdateLlmSettingsRequest) → PUT /api/settings/llm
  testConnection()                       → POST /api/settings/llm/test
```

### 4.3 LlmSettingsPage

```
┌──────────────────────────────────────────────┐
│  Настройки LLM                               │
│──────────────────────────────────────────────│
│                                              │
│  Провайдер:  [z.ai          ▼]  (disabled)   │
│                                              │
│  API Key:    [●●●●●●●●●●●●●●] 👁             │
│                                              │
│  Модель:     [glm-4.6v       ▼]              │
│                                              │
│  Тон:        [Позитивный     ▼]              │
│              Позитивный / Негативный / Нейтральный │
│                                              │
│  Системный промпт:                           │
│  ┌──────────────────────────────────────┐    │
│  │ Ты — помощник, который генерирует   │    │
│  │ комментарии к фото в Instagram...   │    │
│  └──────────────────────────────────────┘    │
│                                              │
│           [🔌 Тест] [💾 Сохранить]            │
└──────────────────────────────────────────────┘
```

- InputComponent: API Key (type="password", toggle visibility)
- QSelect: Provider (disabled, пока один), Model, Tone
- QInput: textarea для system_prompt
- Кнопка "Тест" → testConnection → Notify success/error
- Кнопка "Сохранить" → updateSettings → Notify

### 4.4 shared/lib/useEcho

**Установить:**
```bash
npm install laravel-echo pusher-js
```

**useEcho.ts:**
```typescript
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

window.Pusher = Pusher

export const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST ?? 'localhost',
  wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
  forceTLS: false,
  enabledTransports: ['ws'],
})
```

**Frontend .env (добавить):**
```
VITE_REVERB_APP_KEY=local-reverb-key
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
```

### 4.5 useCommentGeneration composable

```typescript
// features/generate-comment/lib/useCommentGeneration.ts

type GenerationStatus = 'idle' | 'downloading' | 'processing' | 'completed' | 'failed'

interface GenerationStep {
  status: GenerationStatus
  message: string
  active: boolean        // текущий шаг
  done: boolean          // завершён
}

export function useCommentGeneration() {
  const status = ref<GenerationStatus>('idle')
  const statusMessage = ref('')
  const generatedComment = ref('')
  const steps = ref<GenerationStep[]>([])
  const isGenerating = computed(() => !['idle', 'completed', 'failed'].includes(status.value))

  const generate = async (imageUrl: string, captionText: string) => {
    status.value = 'downloading'
    steps.value = [
      { status: 'downloading', message: 'Загрузка изображения...', active: true, done: false },
      { status: 'processing', message: 'Анализ изображения...', active: false, done: false },
      { status: 'completed', message: 'Комментарий готов', active: false, done: false },
    ]

    // 1. POST /api/comments/generate → { job_id }
    const response = await api.post('/comments/generate', { image_url: imageUrl, caption_text: captionText })
    const jobId = response.data.data.job_id

    // 2. Subscribe to WebSocket
    echo.private(`comment-generation.${jobId}`)
      .listen('CommentGenerationProgress', (event) => {
        status.value = event.status
        statusMessage.value = event.message

        // Обновить steps
        steps.value.forEach(step => {
          if (step.status === event.status) {
            step.active = true
          }
          // Все предыдущие шаги — done
          if (statusOrder(step.status) < statusOrder(event.status)) {
            step.done = true
            step.active = false
          }
        })

        if (event.comment) {
          generatedComment.value = event.comment
        }

        // Отписаться при завершении
        if (['completed', 'failed'].includes(event.status)) {
          echo.leave(`comment-generation.${jobId}`)
        }
      })
  }

  const reset = () => {
    status.value = 'idle'
    steps.value = []
    generatedComment.value = ''
  }

  return { status, statusMessage, generatedComment, steps, isGenerating, generate, reset }
}
```

### 4.6 GenerationStatusBlock

**Визуал (QTimeline от Quasar):**
```
┌─────────────────────────────────┐
│ ✅ Загрузка изображения...       │  ← done (зелёная иконка)
│ ⏳ Анализ изображения...         │  ← active (spinner)
│ ○ Комментарий готов              │  ← pending (серая точка)
└─────────────────────────────────┘
```

Props: `steps: GenerationStep[]`

Использовать `QTimeline` + `QTimelineEntry`:
- done → color="positive", icon="check_circle"
- active → color="primary", icon (spinner)
- pending → color="grey", icon="radio_button_unchecked"

### 4.7 Интеграция в SearchPostModal

- Добавить `useCommentGeneration()` composable
- Кнопка "Сгенерировать" (enable/disable теперь по наличию LLM настроек):
  → `generate(post.thumbnail_url, post.caption_text)`
- Показать `GenerationStatusBlock` когда `isGenerating || status === 'completed'`
- При `completed` → вставить `generatedComment` в input комментария
- При `failed` → Notify.create({ type: 'negative', message: statusMessage })
- Кнопка "Сгенерировать" disabled пока `isGenerating`

### 4.8 Порядок реализации

1. entities/llm-settings (types.ts + llmSettingsStore.ts)
2. pages/llm-settings (LlmSettingsPage)
3. router: добавить `/settings/llm` (admin only)
4. `npm install laravel-echo pusher-js`
5. shared/lib/useEcho.ts
6. features/generate-comment/lib/useCommentGeneration.ts
7. features/generate-comment/ui/GenerationStatusBlock.vue
8. features/generate-comment/ui/GenerateCommentButton.vue
9. Интеграция в SearchPostModal (кнопка + статус блок + WebSocket)
10. Frontend .env (Reverb credentials)
11. Тестирование E2E: генерация → WebSocket → UI → вставка комментария
