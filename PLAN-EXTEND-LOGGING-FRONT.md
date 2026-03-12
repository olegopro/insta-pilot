# insta-pilot — Activity Logging Frontend Plan (Vue 3 + Quasar + TypeScript, FSD)

> Детальный план frontend мониторинга активности. Основной план: [PLAN.md](PLAN.md)

---

## Фаза 5 — Мониторинг активности аккаунтов

### 5.1 Новые файлы

```
entities/
  activity-log/
    model/
      types.ts                          # ActivityLog, ActivityStats, ActionType, ActionStatus, AccountActivitySummary
      activityLogStore.ts               # Pinia: fetchLogs, loadMore, fetchStats, fetchSummary
      activityLogTableColumns.ts        # Колонки таблицы логов + ActivityLogRowModel
      activityLogListDTO.ts             # API-модель (snake_case) → RowModel (camelCase)
      activitySummaryTableColumns.ts    # Колонки таблицы обзора + SummaryRowModel
      activitySummaryListDTO.ts         # API → SummaryRowModel
    index.ts

features/
  activity-filter/
    ui/ActivityFilter.vue               # Фильтры: действие, статус, дата от/до
    index.ts
  activity-live/
    lib/useActivityLive.ts              # Composable: подписка WebSocket, real-time записи
    index.ts

widgets/
  activity-stats-cards/
    ui/ActivityStatsCards.vue            # Карточки: Всего, Сегодня, Ошибок, Успех %
    index.ts
  activity-grouped-stats/
    ui/ActivityGroupedStats.vue          # Группировки: по действиям и по статусам
    index.ts
  activity-log-table/
    ui/ActivityLogTable.vue             # Таблица логов с "Загрузить ещё"
    index.ts
  activity-summary-table/
    ui/ActivitySummaryTable.vue          # Таблица обзора аккаунтов (summary page)
    index.ts

pages/
  monitoring/
    ui/MonitoringPage.vue               # Обзор всех аккаунтов
    index.ts
  monitoring-detail/
    ui/MonitoringDetailPage.vue         # Детализация по аккаунту
    index.ts
```

---

### 5.2 entities/activity-log/model/types.ts

```typescript
import type { Nullable } from '@/shared/lib'

export type ActionType =
  | 'login'
  | 'fetch_feed'
  | 'like'
  | 'comment'
  | 'search_hashtag'
  | 'search_locations'
  | 'search_location_medias'
  | 'fetch_user_info'
  | 'generate_comment'

export type ActionStatus =
  | 'success'
  | 'error'
  | 'rate_limited'
  | 'challenge_required'
  | 'login_required'
  | 'timeout'

export interface ActivityLog {
  id: number
  instagram_account_id: number
  user_id: number
  action: ActionType
  status: ActionStatus
  request_payload: Nullable<Record<string, unknown>>
  response_summary: Nullable<Record<string, unknown>>
  error_message: Nullable<string>
  error_code: Nullable<string>
  duration_ms: Nullable<number>
  created_at: string
}

export interface ActionBreakdown {
  total: number
  success: number
  error: number
}

export interface ActivityStats {
  total: number
  today: number
  success_rate: number
  by_action: Record<string, ActionBreakdown>
  by_status: Record<string, number>
  avg_duration_ms: number
  last_error: Nullable<{
    action: string
    error_message: string
    error_code: Nullable<string>
    created_at: string
  }>
}

export interface AccountActivitySummary {
  account_id: number
  instagram_login: string
  total_actions: number
  today_actions: number
  error_count_today: number
  success_rate: number
  last_activity_at: Nullable<string>
  last_error: Nullable<string>
  last_error_at: Nullable<string>
}

export interface ActivityLogsResponse {
  items: ActivityLog[]
  has_more: boolean
  total: number
}

export interface ActivityFilters {
  action?: ActionType
  status?: ActionStatus
  date_from?: string
  date_to?: string
}
```

---

### 5.3 activityLogStore.ts (Pinia)

```
Паттерн: расширенный, с cursor-пагинацией + накопление логов.

ПРИВАТНЫЕ useApi:
  fetchLogsApi    → GET /api/accounts/{id}/activity?...
  fetchStatsApi   → GET /api/accounts/{id}/activity/stats
  fetchSummaryApi → GET /api/activity/summary

ДОПОЛНИТЕЛЬНЫЕ ref (не через useApi — для накопления):
  logs            → ref<ActivityLog[]>([])
  hasMore         → ref(false)
  totalCount      → ref(0)

ПУБЛИЧНЫЕ computed:
  stats           → computed(() => fetchStatsApi.response.value?.data ?? null)
  summary         → computed(() => fetchSummaryApi.response.value?.data ?? [])

ПУБЛИЧНЫЕ actions:
  fetchLogs(accountId, filters?)
    → fetchLogsApi.execute(accountId, filters)
    → logs.value = response.data.items
    → hasMore.value = response.data.has_more
    → totalCount.value = response.data.total

  loadMoreLogs(accountId, filters?)
    → lastId = logs.value[logs.value.length - 1]?.id
    → fetchLogsApi.execute(accountId, { ...filters, before_id: lastId })
    → logs.value = [...logs.value, ...response.data.items]
    → hasMore.value = response.data.has_more

  prependLog(log: ActivityLog)
    → logs.value = [log, ...logs.value]
    → totalCount.value++
    (вызывается из useActivityLive при WebSocket событии)

  resetLogs()
    → logs.value = []
    → hasMore.value = false
    → totalCount.value = 0

  fetchStats(accountId) → fetchStatsApi.execute(accountId)
  fetchSummary()        → fetchSummaryApi.execute()

ПУБЛИЧНЫЕ loading/error:
  fetchLogsLoading    → computed(() => fetchLogsApi.loading.value)
  fetchStatsLoading   → computed(() => fetchStatsApi.loading.value)
  fetchSummaryLoading → computed(() => fetchSummaryApi.loading.value)

return {
  logs, hasMore, totalCount,
  stats, summary,
  fetchLogs, loadMoreLogs, prependLog, resetLogs,
  fetchStats, fetchStatsLoading,
  fetchSummary, fetchSummaryLoading,
  fetchLogsLoading,
}
```

> `logs` — обычный `ref`, не computed от useApi, потому что нужна cursor-пагинация (append) и real-time prepend. Это исключение из стандартного паттерна store.

---

### 5.4 Константы для UI: лейблы и иконки

**Вынести в `entities/activity-log/model/constants.ts`:**

```typescript
export const ACTION_LABELS: Record<ActionType, string> = {
  login:                  'Авторизация',
  fetch_feed:             'Лента',
  like:                   'Лайк',
  comment:                'Комментарий',
  search_hashtag:         'Поиск хэштег',
  search_locations:       'Поиск локаций',
  search_location_medias: 'Медиа локации',
  fetch_user_info:        'Инфо пользователя',
  generate_comment:       'Генерация комм.',
}

export const STATUS_CONFIG: Record<ActionStatus, { label: string; icon: string; color: string }> = {
  success:            { label: 'Успешно',      icon: 'check_circle',  color: 'positive' },
  error:              { label: 'Ошибка',       icon: 'error',         color: 'negative' },
  rate_limited:       { label: 'Лимит',        icon: 'hourglass_top', color: 'warning' },
  challenge_required: { label: 'Подтверждение', icon: 'lock',         color: 'warning' },
  login_required:     { label: 'Нет сессии',   icon: 'vpn_key',       color: 'warning' },
  timeout:            { label: 'Таймаут',      icon: 'timer_off',     color: 'grey' },
}
```

---

### 5.5 DTO и колонки таблицы логов

**activityLogTableColumns.ts:**

```typescript
export interface ActivityLogRowModel {
  id: number
  action: string
  actionLabel: string
  status: string
  statusIcon: string
  statusColor: string
  statusLabel: string
  errorMessage: string | null
  errorCode: string | null
  durationMs: number | null
  durationFormatted: string
  responseSummary: string
  createdAt: string
  timeFormatted: string
}

// Колонки для TableComponent:
// name, action, status, duration, details, time
```

**activityLogListDTO.ts:**

```
Маппинг: ActivityLog (snake_case) → ActivityLogRowModel (camelCase + форматирование)

- action → actionLabel через ACTION_LABELS
- status → statusIcon, statusColor, statusLabel через STATUS_CONFIG
- duration_ms → durationFormatted: "230ms" или "1.2s" или "—"
- response_summary → responseSummary: человекочитаемая строка
  - { items_count: 30 } → "30 записей"
  - { media_pk: "123" } → "media: 123"
  - null → ""
- created_at → timeFormatted: "14:32:01" (только время, дата в фильтрах)
```

---

### 5.6 DTO и колонки таблицы обзора (summary)

**activitySummaryTableColumns.ts:**

```typescript
export interface SummaryRowModel {
  accountId: number
  instagramLogin: string
  totalActions: number
  todayActions: number
  errorCountToday: number
  successRate: string          // "95.2%"
  lastActivityAt: string       // "14:32" или "—"
  lastError: string | null
  lastErrorAt: string | null
}

// Колонки для TableComponent:
// instagram_login, total_actions, today_actions, error_count_today, success_rate, last_activity, last_error
```

**activitySummaryListDTO.ts:**

```
Маппинг: AccountActivitySummary → SummaryRowModel
- success_rate → successRate: `${value.toFixed(1)}%`
- last_activity_at → lastActivityAt: форматированное время или "—"
```

---

### 5.7 MonitoringPage (обзор)

**Роут:** `/monitoring`

```
┌──────────────────────────────────────────────────────────────────┐
│  Мониторинг активности                                            │
│──────────────────────────────────────────────────────────────────│
│                                                                    │
│  [Поиск: ___________]                                              │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Аккаунт  │ Всего │ Сегодня │ Ошибки │ Успех % │ Посл.акт. │  │
│  │──────────│───────│─────────│────────│─────────│───────────│  │
│  │ @user1   │ 1234  │   56    │   3    │  95.2%  │ 14:32     │  │
│  │ @user2   │  890  │   34    │   0    │ 100.0%  │ 14:30     │  │
│  │ @user3   │  456  │   12    │   5    │  91.7%  │ 14:25     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Клик на строку → /monitoring/{accountId}                          │
└──────────────────────────────────────────────────────────────────┘
```

**Компоненты:**
- `ActivitySummaryTable` (widget) — `TableComponent` с колонками обзора
- `useSearchQuery` для поиска по таблице
- `useFilterColumns` для видимости колонок
- `@row-click` → `router.push(/monitoring/${row.accountId})`

**При mount:**
- `activityLogStore.fetchSummary()`

---

### 5.8 MonitoringDetailPage (детализация)

**Роут:** `/monitoring/:accountId`

```
┌──────────────────────────────────────────────────────────────────┐
│  [← Назад]     Мониторинг: @user1                                │
│──────────────────────────────────────────────────────────────────│
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Всего    │  │ Сегодня  │  │ Ошибок   │  │ Успех    │          │
│  │   1234   │  │    56    │  │     3    │  │  95.2%   │          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│                                                                    │
│  ┌───────────────────────────┬──────────────────────────────┐     │
│  │ По действиям              │ По статусам                   │     │
│  │ ─────────────             │ ─────────────                 │     │
│  │ Лайки:   480 ok / 20 err │ Успешно:       1100           │     │
│  │ Коммент:  95 ok /  5 err │ Ошибки:          80           │     │
│  │ Лента:  198 ok /  2 err │ Rate limit:      34           │     │
│  │ Поиск:  300 ok /  0 err │ Таймаут:          6           │     │
│  └───────────────────────────┴──────────────────────────────┘     │
│                                                                    │
│  Фильтры: [Действие ▼] [Статус ▼] [Дата от___] [Дата до___]      │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Время     │ Действие    │ Статус │ Длит.  │ Детали           │  │
│  │───────────│─────────────│────────│────────│─────────────────│  │
│  │ 14:32:01  │ Лайк        │ ❌     │ 1200ms │ rate_limited     │  │
│  │ 14:31:45  │ Лайк        │ ✅     │ 230ms  │                  │  │
│  │ 14:30:12  │ Лента       │ ✅     │ 890ms  │ 30 записей       │  │
│  │ 14:29:50  │ Лайк        │ ✅     │ 210ms  │                  │  │
│  │ ...                                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Показано 100 из 10,000  [Загрузить ещё]                          │
│                                                                    │
│  ● Real-time: подключено                                           │
└──────────────────────────────────────────────────────────────────┘
```

**Параметр:** `accountId` из `route.params`

**Компоненты на странице:**
1. `ActivityStatsCards` — 4 карточки сверху
2. `ActivityGroupedStats` — группировки по действиям и статусам
3. `ActivityFilter` — фильтры (feature)
4. `ActivityLogTable` — таблица логов с cursor-пагинацией
5. Индикатор WebSocket подключения

**При mount:**
1. `activityLogStore.fetchStats(accountId)`
2. `activityLogStore.fetchLogs(accountId)`
3. `useActivityLive(accountId)` — подписка на WebSocket

**При unmount:**
- `activityLogStore.resetLogs()` — очистить накопленные логи
- `useActivityLive` — отписка от WebSocket (автоматически в `onUnmounted`)

---

### 5.9 ActivityStatsCards (widget)

**Props:**
```typescript
interface Props {
  stats: ActivityStats | null
  loading: boolean
}
```

**Визуал:** 4 карточки в ряд (`q-card` + flex):

| Карточка | Значение | Иконка | Цвет |
|----------|----------|--------|------|
| Всего действий | `stats.total` | `bar_chart` | primary |
| Сегодня | `stats.today` | `today` | info |
| Ошибок | `stats.by_status.error + rate_limited + ...` | `error_outline` | negative |
| Успех | `stats.success_rate` + "%" | `check_circle_outline` | positive |

Использовать `QCard` с `QCardSection`.

---

### 5.10 ActivityGroupedStats (widget)

**Props:**
```typescript
interface Props {
  stats: ActivityStats | null
}
```

**Визуал:** два блока (flex или grid):

**Левый — «По действиям»:**
- Для каждого ключа `stats.by_action`:
  - Название (из `ACTION_LABELS`) + `total ok` / `error err`
  - Опционально: `QLinearProgress` — визуализация success/error ratio

**Правый — «По статусам»:**
- Для каждого ключа `stats.by_status`:
  - Иконка + лейбл (из `STATUS_CONFIG`) + количество
  - `QBadge` с цветом статуса

---

### 5.11 ActivityFilter (feature)

**Props:**
```typescript
interface Props {
  modelValue: ActivityFilters
}
```

**Events:**
```typescript
defineEmits<{
  'update:modelValue': [filters: ActivityFilters]
  apply: []
}>()
```

**Элементы:**

| Поле | Компонент | Опции |
|------|-----------|-------|
| Действие | `SelectComponent` | ACTION_LABELS (ключ-значение) + опция "Все" |
| Статус | `SelectComponent` | STATUS_CONFIG (ключ-label) + опция "Все" |
| Дата от | `InputComponent` (type="date") | — |
| Дата до | `InputComponent` (type="date") | — |

При изменении любого фильтра → emit `update:modelValue` + `apply`.

**В MonitoringDetailPage:**
```typescript
const filters = ref<ActivityFilters>({})

const applyFiltersHandler = () => {
  activityLogStore.fetchLogs(accountId, filters.value)
}
```

---

### 5.12 ActivityLogTable (widget)

**Props:**
```typescript
interface Props {
  rows: ActivityLogRowModel[]
  loading: boolean
  hasMore: boolean
  total: number
}
```

**Events:**
```typescript
defineEmits<{
  'load-more': []
}>()
```

**Визуал:**
- `TableComponent` с колонками из `activityLogTableColumns`
- `useFilterColumns` / `useSearchQuery` — опционально
- Колонка «Статус»: `q-icon` с `statusIcon` + `statusColor` из RowModel
- Колонка «Длительность»: `durationFormatted` — цвет меняется при >1000ms (warning)
- Колонка «Детали»: `responseSummary` или `errorMessage` (красным если ошибка)

**Кнопка «Загрузить ещё»:**
- Под таблицей: `ButtonComponent` с текстом "Загрузить ещё"
- Видима только при `hasMore === true`
- При клике → emit `load-more`
- Текст: `Показано ${rows.length} из ${total}`

**Новые записи (real-time):**
- Новые записи от WebSocket добавляются в начало массива через `prependLog`
- Визуальный эффект: `transition-group` с `fade-in` анимацией на новых строках (опционально)

---

### 5.13 useActivityLive composable (feature)

```typescript
// features/activity-live/lib/useActivityLive.ts

import { echo } from '@/shared/lib/useEcho'
import { useActivityLogStore } from '@/entities/activity-log'

export function useActivityLive(accountId: Ref<number | string>) {
  const store = useActivityLogStore()
  const isConnected = ref(false)
  let currentChannel = ''

  const subscribe = () => {
    const id = Number(accountId.value)
    currentChannel = `account-activity.${id}`

    echo.private(currentChannel)
      .listen('ActivityLogCreated', (event: ActivityLog) => {
        store.prependLog(event)
      })
      .subscribed(() => {
        isConnected.value = true
      })
  }

  const unsubscribe = () => {
    currentChannel && echo.leave(currentChannel)
    isConnected.value = false
    currentChannel = ''
  }

  onMounted(subscribe)
  onUnmounted(unsubscribe)

  // Переподписка при смене аккаунта
  watch(accountId, () => {
    unsubscribe()
    subscribe()
  })

  return { isConnected }
}
```

> Зависит от `shared/lib/useEcho.ts` (Фаза 4, Laravel Echo + pusher-js).
> Без Reverb — composable не подключается, таблица обновляется только вручную (refresh).

**Индикатор подключения в MonitoringDetailPage:**
```html
<div class="row items-center q-gutter-xs">
  <q-icon :name="isConnected ? 'circle' : 'circle'" :color="isConnected ? 'positive' : 'grey'" size="xs" />
  <span class="text-caption">Real-time: {{ isConnected ? 'подключено' : 'отключено' }}</span>
</div>
```

---

### 5.14 Router

**Новые роуты:**
```
/monitoring              → MonitoringPage           (meta: { auth: true })
/monitoring/:accountId   → MonitoringDetailPage      (meta: { auth: true })
```

> Доступны всем авторизованным пользователям. User видит только свои аккаунты (фильтрация на backend).

---

### 5.15 MainLayout — навигация

Добавить пункт меню:

| Пункт | Роут | Иконка | Видимость |
|-------|------|--------|-----------|
| Мониторинг | `/monitoring` | `monitoring` или `analytics` | Все авторизованные |

Разместить между «Поиск» и «Настройки LLM»:

```
Аккаунты       /accounts         всем
Лента           /feed             всем (Фаза 2)
Поиск           /search           всем (Фаза 3)
Мониторинг      /monitoring       всем (Фаза 5)   ← НОВЫЙ
Настройки LLM   /settings/llm     admin (Фаза 4)
Пользователи    /admin/users      admin
Выход           —                 всем
```

---

### 5.16 Адаптивность и UX

**MonitoringPage:**
- Таблица обзора: `TableComponent` адаптивна (из shared/ui)
- На мобильных: скрыть колонки `total_actions`, `last_error` (через `useFilterColumns`)

**MonitoringDetailPage:**
- Карточки статистики: `flex-wrap` на мобильных (2x2 вместо 4x1)
- Группировки: `column` layout на мобильных (stack вместо side-by-side)
- Таблица логов: скрыть колонки `duration`, `details` на мобильных
- Кнопка «Загрузить ещё»: `full-width` на мобильных

---

### Порядок реализации

1. `entities/activity-log` (types.ts + constants.ts + index.ts)
2. `activityLogStore.ts` (Pinia: API + cursor-пагинация + prependLog)
3. `activityLogTableColumns.ts` + `activityLogListDTO.ts`
4. `activitySummaryTableColumns.ts` + `activitySummaryListDTO.ts`
5. `widgets/activity-stats-cards` (ActivityStatsCards)
6. `widgets/activity-grouped-stats` (ActivityGroupedStats)
7. `features/activity-filter` (ActivityFilter)
8. `widgets/activity-log-table` (ActivityLogTable + "загрузить ещё")
9. `widgets/activity-summary-table` (ActivitySummaryTable)
10. `pages/monitoring` (MonitoringPage — обзор)
11. `pages/monitoring-detail` (MonitoringDetailPage — детализация)
12. `features/activity-live` (useActivityLive — WebSocket)
13. Router: добавить `/monitoring` и `/monitoring/:accountId`
14. MainLayout: добавить пункт «Мониторинг»
