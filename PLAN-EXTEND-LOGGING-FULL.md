# insta-pilot — Полный план логирования и мониторинга (Фаза 5)

> Мастер-документ по системе логирования. Объединяет и расширяет:
> - [PLAN.md](PLAN.md) — пп. 5.1–5.17 (общий чеклист Фазы 5)
> - [PLAN-EXTEND-LOGGING-BACKEND.md](PLAN-EXTEND-LOGGING-BACKEND.md) — backend: миграция, модель, сервисы, контроллеры, интеграция
> - [PLAN-EXTEND-LOGGING-FRONT.md](PLAN-EXTEND-LOGGING-FRONT.md) — frontend: entity, store, виджеты, страницы MonitoringPage/MonitoringDetailPage

---

## Оглавление

1. [Обзор архитектуры](#1-обзор-архитектуры)
2. [Страница «Логи» (LogsPage)](#2-страница-логи-logspage)
3. [Сайдбар реального времени (ActivitySidebar)](#3-сайдбар-реального-времени-activitysidebar)
4. [Таблица логов с раскрывающимися строками](#4-таблица-логов-с-раскрывающимися-строками)
5. [Обратная бесконечная прокрутка (reverse infinite scroll)](#5-обратная-бесконечная-прокрутка-reverse-infinite-scroll)
6. [WebSocket: real-time broadcasting](#6-websocket-real-time-broadcasting)
7. [Backend: сервис, хранение, API](#7-backend-сервис-хранение-api)
8. [Python: структурированные ошибки](#8-python-структурированные-ошибки)
9. [Интеграция в существующие сервисы](#9-интеграция-в-существующие-сервисы)
10. [FSD-структура новых файлов](#10-fsd-структура-новых-файлов)
11. [Порядок реализации](#11-порядок-реализации)

---

## 1. Обзор архитектуры

### Что логируем

Каждое действие, проходящее через Laravel к Python/Instagram API:

| Action | Откуда вызывается | Что фиксируем |
|--------|-------------------|---------------|
| `login` | [InstagramAccountController:login()](backend-laravel/app/Http/Controllers/InstagramAccountController.php) | session restored/created, device_profile |
| `fetch_feed` | [FeedController:index()](backend-laravel/app/Http/Controllers/FeedController.php) | items_count, has_more, max_id |
| `like` | [FeedController:like()](backend-laravel/app/Http/Controllers/FeedController.php) | media_pk |
| `comment` | CommentController:store() | media_pk, comment_pk, text_length |
| `search_hashtag` | SearchController:hashtag() | hashtag, results_count |
| `search_locations` | SearchController:locations() | query, results_count |
| `search_location_medias` | SearchController:locationMedias() | location_pk, results_count |
| `fetch_user_info` | InstagramUserController:show() | user_pk, username |
| `generate_comment` | [GenerateCommentJob](backend-laravel/app/Jobs/GenerateCommentJob.php) | comment_length, llm_provider |

### Что НЕ логируем

- Прямые SQL-запросы к PostgreSQL
- Фронтенд-события (клики, навигация)
- Содержимое session_data, паролей, cookies
- Полные response body от Instagram (только summary)

### Поток данных

```
[Контроллер/Job]
       │
       ▼
[ActivityLoggerService.log()]
       │
       ├──► INSERT в account_activity_logs (PostgreSQL)
       │
       └──► broadcast(ActivityLogCreated) ──► Laravel Reverb
                                                    │
                                    ┌───────────────┴───────────────┐
                                    ▼                               ▼
                          [ActivitySidebar]                 [LogsPage таблица]
                          (useActivityLive)                 (useActivityLive)
                          упрощённый вид                    полный вид
```

### Каналы WebSocket

| Канал | Подписчики | Данные |
|-------|-----------|--------|
| `private:account-activity.{accountId}` | LogsPage (фильтр по аккаунту), Sidebar | ActivityLog entry |
| `private:activity-global.{userId}` | Sidebar (все аккаунты пользователя) | ActivityLog entry |

> **Два канала** — потому что Sidebar слушает ВСЕ аккаунты пользователя одновременно, а LogsPage — только выбранный. Sidebar подписывается на `activity-global.{userId}`, backend broadcast'ит в оба канала параллельно.

---

## 2. Страница «Логи» (LogsPage)

### Роут и навигация

```
/logs                    → LogsPage (обзор всех аккаунтов)
/logs/:accountId         → LogsPage (детализация по аккаунту)
```

> Ранее в [PLAN.md:26](PLAN.md#L26) и [PLAN-EXTEND-LOGGING-FRONT.md:310-331](PLAN-EXTEND-LOGGING-FRONT.md#L310) запланированы `/monitoring` и `/monitoring/:accountId` как две отдельные страницы. Объединяем в одну LogsPage с переключением режима — это проще для навигации из Sidebar и для якорей.

**Навигация в Header** (после «Поиск», перед «Настройки LLM»):

```
Аккаунты | Лента | Поиск | Логи | Настройки LLM | Пользователи
```

> Файл: [MainLayout.vue](frontend-vue/src/layouts/MainLayout.vue) — добавить `<q-btn flat to="/logs" label="Логи" />` между строками 24 и 25.

### Макет: обзор (`/logs`)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Логи                                                                │
│──────────────────────────────────────────────────────────────────────│
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ Аккаунт  │ Всего │ Сегодня │ Ошибки │ Успех % │ Посл.акт.  │    │
│  │──────────│───────│─────────│────────│─────────│────────────│    │
│  │ @user1   │ 1234  │   56    │   3    │  95.2%  │ 14:32      │    │
│  │ @user2   │  890  │   34    │   0    │ 100.0%  │ 14:30      │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Клик на строку → /logs/{accountId}                                  │
└──────────────────────────────────────────────────────────────────────┘
```

> API: `GET /api/activity/summary` (см. [PLAN-EXTEND-LOGGING-BACKEND.md:293-315](PLAN-EXTEND-LOGGING-BACKEND.md#L293))

### Макет: детализация (`/logs/:accountId`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [← Все аккаунты]       Логи: @user1                                    │
│──────────────────────────────────────────────────────────────────────────│
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Всего    │  │ Сегодня  │  │ Ошибок   │  │ Успех    │                │
│  │   1234   │  │    56    │  │     3    │  │  95.2%   │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │
│                                                                          │
│  ┌─ Фильтры ──────────────────────────────────────────────────────┐     │
│  │ [Действие ▼]  [Статус ▼]  [Дата от___]  [Дата до___]  [Сброс] │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  ┌─ Группировки (сворачиваемый блок) ────────────────────────────┐     │
│  │  По действиям:              │  По статусам:                    │     │
│  │  ├ Лайки: 480 ok / 20 err  │  ├ Успешно:       1100          │     │
│  │  ├ Коммент: 95 ok / 5 err  │  ├ Ошибки:          80          │     │
│  │  └ Лента: 198 ok / 2 err   │  └ Rate limit:      34          │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  ┌─ Таблица логов ───────────────────────────────────────────────┐     │
│  │                         ▲ Scroll up = загрузить старые записи  │     │
│  │─────────────────────────────────────────────────────────────── │     │
│  │ Время     │ Тип     │ Код │ URL/Действие  │ Длит.  │          │     │
│  │───────────│─────────│─────│───────────────│────────│          │     │
│  │ 14:29:50  │ 🟢 like │ 200 │ /media/like   │ 210ms  │          │     │
│  │ 14:30:12  │ 🟢 feed │ 200 │ /account/feed │ 890ms  │  ◄───── │     │
│  │ 14:31:45  │ 🟢 like │ 200 │ /media/like   │ 230ms  │  обычный│     │
│  │ 14:32:01  │ 🔴 like │ 429 │ /media/like   │ 1200ms │  скролл │     │
│  │───────────│─────────│─────│───────────────│────────│          │     │
│  │ ► 14:32:01  Раскрытая строка (expandable row)       ▼         │     │
│  │   ┌─ Request ──────────────────────────────────┐              │     │
│  │   │ POST /media/like                           │              │     │
│  │   │ { "media_pk": "3456789" }                  │              │     │
│  │   └────────────────────────────────────────────┘              │     │
│  │   ┌─ Response ─────────────────────────────────┐              │     │
│  │   │ { "error": "Rate limit exceeded" }         │              │     │
│  │   │ error_code: rate_limited                   │              │     │
│  │   │ HTTP Status: 429                           │              │     │
│  │   └────────────────────────────────────────────┘              │     │
│  │─────────────────────────────────────────────────────────────── │     │
│  │                        Новые записи появляются внизу ▼ (WS)   │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  Показано 150 из 10,000   ● Real-time: подключено                       │
│                                                                          │
│  ┌─ #anchor-5001 ─ Якорная строка (подсветка при переходе из sidebar) ┐ │
│  └───────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### Якоря для навигации из Sidebar

При клике на запись в Sidebar → `router.push({ path: '/logs/{accountId}', query: { highlight: logId } })`.

На LogsPage:
1. Прочитать `route.query.highlight`
2. Если лог с таким `id` уже загружен — скроллить к нему + подсветить (CSS class `highlight-row` с fade-out анимацией 3 сек)
3. Если не загружен — загрузить страницу логов вокруг этого `id` (специальный API параметр `around_id`)

### Что нового относительно PLAN-EXTEND-LOGGING-FRONT.md

| Аспект | Было (PLAN-EXTEND-LOGGING-FRONT.md) | Стало |
|--------|---------------------------------------|-------|
| Страницы | 2: MonitoringPage + MonitoringDetailPage | 1: LogsPage с двумя режимами |
| Роут | `/monitoring`, `/monitoring/:accountId` | `/logs`, `/logs/:accountId` |
| Таблица логов | Обычный скролл вниз + кнопка «Загрузить ещё» | Reverse infinite scroll вверх + новые записи внизу (WS) |
| Строки таблицы | Плоские | Expandable (раскрываемые с JSON деталями) |
| Бэджи | Статус (icon+color) | Статус + HTTP-код + тип действия (три бэджа) |
| Sidebar | Не было | Новый компонент (см. раздел 3) |
| Якоря | Не было | `?highlight=logId` + подсветка строки |
| API `around_id` | Не было | Новый query-параметр для загрузки контекста вокруг конкретного лога |

---

## 3. Сайдбар реального времени (ActivitySidebar)

### Концепция

Полупрозрачная панель слева, интегрированная в layout (не overlay, не position:absolute), которая:
- Присутствует на всех страницах (живёт в MainLayout)
- Показывает real-time поток действий по ВСЕМ аккаунтам пользователя
- Сохраняет состояние при переключении страниц (не пересоздаётся)
- Ресайзится мышкой по ширине

### Кнопка-триггер

Круглая кнопка в левом нижнем углу (`position: fixed, bottom: 16px, left: 16px, z-index: 100`):
- `q-btn round color="primary" icon="terminal"` (или `bug_report`)
- При нажатии — toggle sidebar open/close
- Когда sidebar открыт — кнопка прячется (или перемещается внутрь sidebar)
- Бэдж на кнопке: количество новых записей с момента последнего открытия

### Интеграция в Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Header: Аккаунты | Лента | Поиск | Логи | ...                      │
├────────────────┬─────────────────────────────────────────────────────┤
│                │                                                     │
│  ActivitySidebar│           <router-view />                          │
│  (300px, resize)│          (q-page-container)                        │
│                │                                                     │
│  ┌────────────┐│                                                     │
│  │ 14:32 🔴   ││                                                     │
│  │ like 429   ││                                                     │
│  │────────────││                                                     │
│  │ 14:31 🟢   ││                                                     │
│  │ like 200   ││                                                     │
│  │────────────││                                                     │
│  │ 14:30 🟢   ││                                                     │
│  │ feed 200   ││                                                     │
│  │ 30 items   ││                                                     │
│  └────────────┘│                                                     │
│                │                                                     │
├────────────────┴─────────────────────────────────────────────────────┤
│  [●] ← кнопка (когда sidebar закрыт)                                │
└──────────────────────────────────────────────────────────────────────┘
```

> **Ключевое**: sidebar — это `<div>` внутри flex-контейнера, НЕ поверх контента. При открытии контент (router-view) сужается. Используем Quasar `QDrawer` с `side="left"` и `overlay=false`, либо кастомный flex-layout.

### Реализация в MainLayout

**Вариант: QDrawer (рекомендуемый)**

Quasar `QDrawer` с `side="left"` идеально подходит:
- `v-model="sidebarOpen"` — toggle
- `:width="sidebarWidth"` — ширина (ref, от 250 до 500)
- `:breakpoint="0"` — всегда side-panel, не overlay
- `bordered` — визуальное разделение
- Внутри — компонент `ActivitySidebar`

**Resize handle**:
- Вертикальная полоска 4px на правой границе QDrawer
- `cursor: col-resize`
- `@mousedown` → слушать `mousemove` → обновлять `sidebarWidth`
- Min: 250px, Max: 600px, Default: 320px
- Сохранять ширину в `localStorage('sidebar_width')`

### Содержимое Sidebar

```
┌─ ActivitySidebar ──────────────────────┐
│  Активность            [🔍] [✕]       │
│────────────────────────────────────────│
│  [Все] [Ошибки] [Лайки] [Коммент]     │  ← быстрые фильтры (chip toggle)
│────────────────────────────────────────│
│                                        │
│  ┌ 14:32:01 ─────────────────────────┐ │
│  │ 🔴 like  429  @user1             │ │  ← клик → router.push('/logs/1?highlight=5001')
│  │ Rate limit exceeded               │ │
│  └───────────────────────────────────┘ │
│                                        │
│  ┌ 14:31:45 ─────────────────────────┐ │
│  │ 🟢 like  200  @user1             │ │
│  └───────────────────────────────────┘ │
│                                        │
│  ┌ 14:30:12 ─────────────────────────┐ │
│  │ 🟢 feed  200  @user2             │ │
│  │ 30 записей                        │ │
│  └───────────────────────────────────┘ │
│                                        │
│  ┌ 14:29:03 ─────────────────────────┐ │
│  │ 🟡 gen_comment  @user1            │ │
│  │ Генерация: 45 символов            │ │
│  └───────────────────────────────────┘ │
│                                        │
│                      ...новые внизу... │
│────────────────────────────────────────│
│  150 записей  ● Подключено            │
└────────────────────────────────────────┘
```

### Каждая запись в Sidebar

Компактная карточка (высота ~50-60px):
- **Строка 1**: Бэдж статуса (🟢/🔴/🟡) + action label + HTTP-код (если есть) + `@account_login`
- **Строка 2** (опциональная): краткий текст (error_message или response summary в одну строку)
- **Hover**: лёгкая подсветка фона
- **Click**: `router.push({ path: '/logs/{accountId}', query: { highlight: logId } })`

### Хранение состояния Sidebar

Sidebar живёт в MainLayout → его состояние (открыт/закрыт, ширина, накопленные записи) переживает навигацию между страницами.

Создать **отдельный Pinia store** для sidebar: `sidebarActivityStore`:
- `entries: ref<SidebarActivityEntry[]>([])` — массив записей (max 200, FIFO)
- `unreadCount: ref(0)` — счётчик непрочитанных (сбрасывается при открытии)
- `isOpen: ref(false)` — состояние sidebar
- `width: ref(320)` — ширина
- `quickFilter: ref<'all' | 'errors' | 'likes' | 'comments'>('all')`
- `addEntry(entry)` — prepend или append (новые внизу)
- `filteredEntries` — computed с фильтрацией

> `SidebarActivityEntry` — упрощённый тип (без request_payload/response_summary полных объектов):
```typescript
interface SidebarActivityEntry {
  id: number
  accountId: number
  accountLogin: string
  action: ActionType
  status: ActionStatus
  httpCode: number | null      // HTTP status code (200, 429, 500...)
  shortMessage: string | null  // error_message или краткое response summary
  durationMs: number | null
  createdAt: string
}
```

### WebSocket подписка для Sidebar

Composable `useGlobalActivityLive` в MainLayout:
1. При mount → получить список аккаунтов пользователя (из `accountStore.accounts`)
2. Подписаться на `private:activity-global.{userId}` — один канал для всех аккаунтов
3. При получении события → `sidebarActivityStore.addEntry(event)`
4. При logout/unmount → отписка

> Backend при логировании broadcast'ит в ОБА канала: `account-activity.{accountId}` (для LogsPage) и `activity-global.{userId}` (для Sidebar).

---

## 4. Таблица логов с раскрывающимися строками

### Expandable rows

Quasar QTable поддерживает expandable rows нативно. Используем `#body` slot (или `#body-cell` + `expand`).

> Ранее в [PLAN-EXTEND-LOGGING-FRONT.md:490-525](PLAN-EXTEND-LOGGING-FRONT.md#L490) описана плоская таблица. Расширяем до expandable.

### Колонки таблицы

| # | name | label | Бэдж/формат | Ширина |
|---|------|-------|------------|--------|
| 1 | `time` | Время | `HH:mm:ss` | 80px |
| 2 | `action` | Действие | `QBadge` с action label + иконкой | 140px |
| 3 | `status` | Статус | `QBadge` с иконкой (🟢/🔴/🟡) + текст | 120px |
| 4 | `httpCode` | Код | `QBadge` цвет по диапазону (2xx=green, 4xx=warning, 5xx=red) | 60px |
| 5 | `endpoint` | Endpoint | Python endpoint URL (`/media/like`, `/account/feed`) | auto |
| 6 | `duration` | Длит. | `230ms` / `1.2s` + цвет (>1s = warning, >3s = red) | 80px |
| 7 | `expand` | | Стрелка ▶/▼ для раскрытия | 40px |

### Раскрытая строка (expanded row)

При клике на строку (или стрелку) — под ней появляется блок деталей:

```
┌─ Детали запроса #5001 ─────────────────────────────────────────────┐
│                                                                     │
│  ┌─ Request ─────────────────────┐  ┌─ Response ─────────────────┐ │
│  │ POST /media/like              │  │ HTTP 429                   │ │
│  │                               │  │                            │ │
│  │ {                             │  │ {                          │ │
│  │   "media_pk": "3456789"       │  │   "error": "Rate limit",  │ │
│  │ }                             │  │   "error_code":            │ │
│  │                               │  │     "rate_limited"         │ │
│  └───────────────────────────────┘  └────────────────────────────┘ │
│                                                                     │
│  Account: @user1 (id: 1)                                           │
│  User: admin@insta-pilot.local (id: 1)                             │
│  Duration: 1200ms                                                   │
│  Created: 2026-03-16 14:32:01.234                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**JSON форматирование**: использовать `<pre>` с syntax highlighting (опционально — CSS class для ключей/значений) или просто `JSON.stringify(data, null, 2)` в `<pre class="log-json">`.

### Бэджи: стилистика

**Action badge:**
```
🔑 login          — серо-голубой
📋 fetch_feed     — голубой
❤️ like           — розовый
💬 comment        — фиолетовый
🔍 search_*       — зелёный
👤 fetch_user_info — серый
🤖 generate_comment — оранжевый
```

**Status badge:**
```
🟢 success         — positive (зелёный)
🔴 error           — negative (красный)
🟡 rate_limited    — warning (жёлтый)
🟡 challenge_required — warning
🟡 login_required  — warning
⚪ timeout         — grey
```

**HTTP code badge:**
```
2xx → positive (зелёный)
4xx → warning (жёлтый/оранжевый)
5xx → negative (красный)
null → не показывать
```

---

## 5. Обратная бесконечная прокрутка (reverse infinite scroll)

### Проблема

Обычный infinite scroll вниз — Quasar QInfiniteScroll — загружает при скролле к низу. Нужно наоборот: новые записи внизу (WS), при скролле вверх — подгрузка старых.

### Решение: «prepend without jump»

Ключевая техника — **сохранение scrollTop при prepend'е элементов сверху**:

```typescript
// composable: useReverseInfiniteScroll

function useReverseInfiniteScroll(containerRef: Ref<HTMLElement | null>) {
  const isLoadingOlder = ref(false)

  const onScroll = async (loadOlderFn: () => Promise<void>) => {
    const el = containerRef.value
    if (!el || isLoadingOlder.value) return

    // Если скролл близко к верху (< 100px от верхнего края)
    if (el.scrollTop < 100) {
      isLoadingOlder.value = true

      // Запомнить текущую позицию
      const prevScrollHeight = el.scrollHeight
      const prevScrollTop = el.scrollTop

      // Загрузить старые записи (prepend в массив)
      await loadOlderFn()

      // После рендера (nextTick) — скорректировать скролл
      await nextTick()
      const newScrollHeight = el.scrollHeight
      const addedHeight = newScrollHeight - prevScrollHeight
      el.scrollTop = prevScrollTop + addedHeight

      isLoadingOlder.value = false
    }
  }

  return { isLoadingOlder, onScroll }
}
```

### Как работает

1. **Первая загрузка** → `fetchLogs(accountId, { per_page: 50 })` → последние 50 записей, отсортированные `id DESC` → на UI отображаются `id ASC` (самые старые вверху, новые внизу)
2. **Скролл вверх** → `el.scrollTop < 100` → триггер `loadOlderLogs()`:
   - `fetchLogs(accountId, { before_id: firstVisibleId, per_page: 50 })` → следующие 50 более старых
   - Prepend в массив → `logs = [...olderLogs, ...logs]`
   - Скорректировать `scrollTop` += добавленная высота → окно НЕ прыгает
3. **Новые записи (WebSocket)** → append в конец массива → `logs = [...logs, newEntry]`
   - Если пользователь не скроллил вверх (scrollTop ≈ bottom) → auto-scroll вниз
   - Если скроллил вверх → НЕ auto-scroll, показать «↓ N новых записей» бэдж внизу

### API параметры для этого

```
GET /api/accounts/{accountId}/activity
  ?per_page=50
  &before_id=5001        — старые записи (id < 5001)
  &after_id=5050         — новые записи (id > 5050) — для catch-up при reconnect
  &around_id=5025        — записи вокруг id (для якорей из sidebar)
  &action=like           — фильтр
  &status=error          — фильтр
```

> `after_id` и `around_id` — **новые** параметры, не описаны в [PLAN-EXTEND-LOGGING-BACKEND.md:202-210](PLAN-EXTEND-LOGGING-BACKEND.md#L202). Добавить.

### `around_id` — загрузка контекста

Для якорей из Sidebar:
1. `GET /api/accounts/{accountId}/activity?around_id=5025&per_page=50`
2. Backend: `WHERE id BETWEEN (5025 - 25) AND (5025 + 25)` (примерно)
3. Точнее: загрузить 25 записей до и 25 записей после `around_id`, включая сам `around_id`
4. Frontend: отобразить → скроллить к `#log-5025` → подсветить

---

## 6. WebSocket: real-time broadcasting

### Каналы и события

**Канал 1: `private:account-activity.{accountId}`**
- Для LogsPage при просмотре конкретного аккаунта
- Подписка: `useActivityLive(accountId)` composable
- Событие: `ActivityLogCreated`

**Канал 2: `private:activity-global.{userId}`**
- Для Sidebar — все аккаунты пользователя в одном канале
- Подписка: `useGlobalActivityLive()` composable (в MainLayout)
- Событие: `ActivityLogCreated`

### Авторизация каналов

> Файл: [channels.php](backend-laravel/routes/channels.php) — добавить два канала.

```php
// account-activity.{accountId} — конкретный аккаунт
Broadcast::channel('account-activity.{accountId}', function ($user, $accountId) {
    if ($user->hasRole('admin')) return true;
    return InstagramAccount::where('id', $accountId)
        ->where('user_id', $user->id)
        ->exists();
});

// activity-global.{userId} — все аккаунты пользователя
Broadcast::channel('activity-global.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});
```

> Уже описано в [PLAN-EXTEND-LOGGING-BACKEND.md:176-186](PLAN-EXTEND-LOGGING-BACKEND.md#L176), но канал `activity-global` — **новый**.

### Данные события (broadcastWith)

```php
// ActivityLogCreated event
public function broadcastWith(): array
{
    return [
        'id'                    => $this->log->id,
        'instagram_account_id'  => $this->log->instagram_account_id,
        'instagram_login'       => $this->log->instagramAccount->instagram_login,
        'user_id'               => $this->log->user_id,
        'action'                => $this->log->action,
        'status'                => $this->log->status,
        'http_code'             => $this->log->http_code,
        'endpoint'              => $this->log->endpoint,
        'request_payload'       => $this->log->request_payload,
        'response_summary'      => $this->log->response_summary,
        'error_message'         => $this->log->error_message,
        'error_code'            => $this->log->error_code,
        'duration_ms'           => $this->log->duration_ms,
        'created_at'            => $this->log->created_at->toISOString(),
    ];
}
```

### Broadcast в два канала одновременно

```php
public function broadcastOn(): array
{
    return [
        new PrivateChannel("account-activity.{$this->log->instagram_account_id}"),
        new PrivateChannel("activity-global.{$this->log->user_id}"),
    ];
}
```

### Frontend: useActivityLive (для LogsPage)

> Ранее описан в [PLAN-EXTEND-LOGGING-FRONT.md:530-571](PLAN-EXTEND-LOGGING-FRONT.md#L530). Обновляем:

```typescript
// features/activity-live/lib/useActivityLive.ts
export function useActivityLive(accountId: Ref<number>) {
  const store = useActivityLogStore()
  const isConnected = ref(false)
  let channelName = ''

  const subscribe = () => {
    channelName = `account-activity.${accountId.value}`
    echo.private(channelName)
      .listen('.ActivityLogCreated', (event: ActivityLogApi) => {
        store.appendNewLog(event)  // append внизу (новые)
      })
      .subscribed(() => { isConnected.value = true })
  }

  const unsubscribe = () => {
    channelName && echo.leave(channelName)
    isConnected.value = false
  }

  watch(accountId, () => { unsubscribe(); subscribe() })
  onMounted(subscribe)
  onBeforeUnmount(unsubscribe)

  return { isConnected }
}
```

### Frontend: useGlobalActivityLive (для Sidebar)

```typescript
// features/activity-live/lib/useGlobalActivityLive.ts
export function useGlobalActivityLive() {
  const authStore = useAuthStore()
  const sidebarStore = useSidebarActivityStore()
  const isConnected = ref(false)
  let channelName = ''

  const subscribe = () => {
    const userId = authStore.user?.id
    if (!userId) return

    channelName = `activity-global.${userId}`
    echo.private(channelName)
      .listen('.ActivityLogCreated', (event: SidebarActivityEntryApi) => {
        sidebarStore.addEntry(mapToSidebarEntry(event))
      })
      .subscribed(() => { isConnected.value = true })
  }

  const unsubscribe = () => {
    channelName && echo.leave(channelName)
    isConnected.value = false
  }

  return { isConnected, subscribe, unsubscribe }
}
```

Вызов в MainLayout.vue:
```typescript
const { isConnected, subscribe, unsubscribe } = useGlobalActivityLive()

onMounted(subscribe)
onBeforeUnmount(unsubscribe)
```

---

## 7. Backend: сервис, хранение, API

### Схема БД: account_activity_logs (расширенная)

> Базовая схема — [PLAN-EXTEND-LOGGING-BACKEND.md:9-33](PLAN-EXTEND-LOGGING-BACKEND.md#L9). Расширяем:

```
account_activity_logs:
  id                    bigIncrements
  instagram_account_id  foreignId → instagram_accounts, cascadeOnDelete
  user_id               foreignId → users, cascadeOnDelete
  action                string                  // login, fetch_feed, like, ...
  status                string                  // success, error, rate_limited, ...
  http_code             smallInteger, nullable   // ← НОВОЕ: HTTP status code от Python
  endpoint              string, nullable         // ← НОВОЕ: Python endpoint URL
  request_payload       json, nullable
  response_summary      json, nullable
  error_message         text, nullable
  error_code            string, nullable
  duration_ms           integer, nullable
  created_at            timestamp
```

**Новые поля:**
- `http_code` — HTTP статус-код ответа Python-сервиса (200, 400, 429, 500). Нужен для бэджей в таблице и фильтрации
- `endpoint` — URL эндпоинта Python (`/media/like`, `/account/feed`). Нужен для колонки «Endpoint» в таблице

**Индексы** (дополнительно к описанным в PLAN-EXTEND-LOGGING-BACKEND.md):
- `(instagram_account_id, id)` — для cursor-пагинации (вместо `created_at`, т.к. `id` монотонен и уникален)
- `(user_id, id)` — для summary и глобального канала

### ActivityLoggerService (расширенный)

> Базовый интерфейс — [PLAN-EXTEND-LOGGING-BACKEND.md:96-108](PLAN-EXTEND-LOGGING-BACKEND.md#L96). Добавляем `httpCode` и `endpoint`:

```php
interface ActivityLoggerServiceInterface {
    public function log(
        int $accountId,
        int $userId,
        string $action,
        string $status,
        ?int $httpCode = null,          // ← НОВОЕ
        ?string $endpoint = null,       // ← НОВОЕ
        ?array $requestPayload = null,
        ?array $responseSummary = null,
        ?string $errorMessage = null,
        ?string $errorCode = null,
        ?int $durationMs = null,
    ): AccountActivityLog;
}
```

**Реализация:**
1. Санитизация `$requestPayload` (удалить пароли, session_data и т.д.)
2. `AccountActivityLog::create([...])` с `created_at => now()`
3. `broadcast(new ActivityLogCreated($log))` — в оба канала
4. Return модель

### ActivityLogController: новые параметры

> Базовый контроллер — [PLAN-EXTEND-LOGGING-BACKEND.md:192-242](PLAN-EXTEND-LOGGING-BACKEND.md#L192). Добавляем:

**index — расширенные query параметры:**
```
per_page:    integer, default 50, max 100
before_id:   integer, nullable           // cursor: записи старше (id < X)
after_id:    integer, nullable           // ← НОВОЕ: записи новее (id > X)
around_id:   integer, nullable           // ← НОВОЕ: записи вокруг (для якорей)
action:      string, nullable
status:      string, nullable
http_code:   integer, nullable           // ← НОВОЕ: фильтр по HTTP-коду
date_from:   string (Y-m-d), nullable
date_to:     string (Y-m-d), nullable
```

**around_id — логика:**
```php
if ($aroundId) {
    // Загрузить per_page/2 записей до и per_page/2 после aroundId
    $half = intdiv($perPage, 2);

    $before = ActivityLog::where('instagram_account_id', $accountId)
        ->where('id', '<=', $aroundId)
        ->orderBy('id', 'desc')
        ->limit($half + 1)
        ->get()
        ->reverse()
        ->values();

    $after = ActivityLog::where('instagram_account_id', $accountId)
        ->where('id', '>', $aroundId)
        ->orderBy('id', 'asc')
        ->limit($half)
        ->get();

    $items = $before->merge($after);
    // has_more_before = $before->count() > $half
    // has_more_after = $after->count() >= $half
}
```

**Ответ (расширенный):**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "has_more_before": true,
    "has_more_after": false,
    "total": 10000,
    "focused_id": 5025
  },
  "message": "OK"
}
```

### ActivityLogRepository (расширенный)

> Базовый — [PLAN-EXTEND-LOGGING-BACKEND.md:319-351](PLAN-EXTEND-LOGGING-BACKEND.md#L319). Добавляем:

```php
interface ActivityLogRepositoryInterface {
    public function getByAccount(
        int $accountId,
        ?string $action = null,
        ?string $status = null,
        ?int $httpCode = null,          // ← НОВОЕ
        ?string $dateFrom = null,
        ?string $dateTo = null,
        int $perPage = 50,
        ?int $beforeId = null,
        ?int $afterId = null,           // ← НОВОЕ
        ?int $aroundId = null,          // ← НОВОЕ
    ): array;

    public function getStatsByAccount(int $accountId): array;
    public function getSummary(?int $userId = null): Collection;
    public function pruneOlderThan(int $days): int;
}
```

---

## 8. Python: структурированные ошибки

> Описано в [PLAN-EXTEND-LOGGING-BACKEND.md:369-401](PLAN-EXTEND-LOGGING-BACKEND.md#L369). Без изменений, только уточнение:

**Файл:** [main.py](python-service/main.py)

**Текущий формат ошибок** (строки с `try/except` в каждом endpoint):
```python
{"success": False, "error": "описание ошибки"}
```

**Новый формат:**
```python
{"success": False, "error": "описание ошибки", "error_code": "rate_limited"}
```

**Утилита:**
```python
# python-service/utils.py
from instagrapi.exceptions import (
    ChallengeRequired, LoginRequired,
    PleaseWaitFewMinutes, FeedbackRequired,
    ClientThrottledError
)
from httpx import ConnectTimeout, ReadTimeout

def error_to_code(exc: Exception) -> str:
    mapping = {
        ChallengeRequired: 'challenge_required',
        LoginRequired: 'login_required',
        PleaseWaitFewMinutes: 'rate_limited',
        FeedbackRequired: 'rate_limited',
        ClientThrottledError: 'rate_limited',
        ConnectTimeout: 'timeout',
        ReadTimeout: 'timeout',
    }
    for exc_type, code in mapping.items():
        if isinstance(exc, exc_type):
            return code
    return 'error'
```

**Также**: Python должен возвращать HTTP status code, который Laravel может записать в `http_code`:
- Успех: HTTP 200
- Rate limit: HTTP 429
- Auth: HTTP 401
- Timeout: HTTP 504
- Прочие ошибки: HTTP 500

> Сейчас Python возвращает JSON с `success: false`, но HTTP код может быть 200. Нужно обновить: при ошибке возвращать соответствующий HTTP status code, чтобы Laravel мог записать его в `http_code` лога.

---

## 9. Интеграция в существующие сервисы

### InstagramClientService

> Базовый паттерн — [PLAN-EXTEND-LOGGING-BACKEND.md:405-486](PLAN-EXTEND-LOGGING-BACKEND.md#L405). Расширяем с `httpCode` и `endpoint`:

**Файл:** [InstagramClientService.php](backend-laravel/app/Services/InstagramClientService.php)

**DI**: добавить `ActivityLoggerServiceInterface` в конструктор.

**Паттерн для каждого метода:**
```php
public function getFeed(InstagramAccount $account, ...): array
{
    $start = microtime(true);
    $endpoint = '/account/feed';

    try {
        $response = Http::timeout(60)->post($this->pythonUrl . $endpoint, [...]);
        $durationMs = (int) ((microtime(true) - $start) * 1000);

        $this->activityLogger->log(
            accountId:       $account->id,
            userId:          auth()->id(),
            action:          'fetch_feed',
            status:          $response->successful() ? 'success' : $this->detectStatus($response),
            httpCode:        $response->status(),
            endpoint:        $endpoint,
            requestPayload:  ['max_id' => $maxId],
            responseSummary: ['items_count' => count($result['items'] ?? [])],
            durationMs:      $durationMs,
        );

        return $response->json();
    } catch (\Exception $e) {
        $durationMs = (int) ((microtime(true) - $start) * 1000);

        $this->activityLogger->log(
            accountId:    $account->id,
            userId:       auth()->id(),
            action:       'fetch_feed',
            status:       $this->detectErrorCode($e) ?? 'error',
            httpCode:     null,
            endpoint:     $endpoint,
            errorMessage: $e->getMessage(),
            errorCode:    $this->detectErrorCode($e),
            durationMs:   $durationMs,
        );

        throw $e;
    }
}
```

**Методы для обновления:**

| Метод | action | endpoint |
|-------|--------|----------|
| `login()` | `login` | `/auth/login` |
| `getFeed()` | `fetch_feed` | `/account/feed` |
| `addLike()` | `like` | `/media/like` |
| `commentMedia()` | `comment` | `/media/comment` |
| `searchHashtag()` | `search_hashtag` | `/search/hashtag` |
| `searchLocations()` | `search_locations` | `/search/locations` |
| `searchLocationMedias()` | `search_location_medias` | `/search/location` |
| `getUserInfoByPk()` | `fetch_user_info` | `/user/info` |

### GenerateCommentJob

> Описано в [PLAN-EXTEND-LOGGING-BACKEND.md:490-529](PLAN-EXTEND-LOGGING-BACKEND.md#L490).

**Файл:** [GenerateCommentJob.php](backend-laravel/app/Jobs/GenerateCommentJob.php)

Добавить `accountId` и `userId` в конструктор Job. Передавать при dispatch из [CommentGenerateController.php](backend-laravel/app/Http/Controllers/CommentGenerateController.php).

---

## 10. FSD-структура новых файлов

### Полный список новых файлов

```
frontend-vue/src/
│
├── entities/
│   └── activity-log/
│       ├── model/
│       │   ├── types.ts                          # ActivityLog, ActivityLogApi, SidebarActivityEntry, etc.
│       │   ├── apiTypes.ts                       # API-форматы (snake_case)
│       │   ├── constants.ts                      # ACTION_LABELS, STATUS_CONFIG, HTTP_CODE_COLORS
│       │   ├── activityLogStore.ts               # Pinia: logs, loadOlder, appendNew, stats, summary
│       │   ├── sidebarActivityStore.ts           # Pinia: entries (FIFO 200), isOpen, width, filters
│       │   ├── activityLogTableColumns.ts        # QTable columns + ActivityLogRowModel
│       │   ├── activityLogListDTO.ts             # API → RowModel маппинг
│       │   ├── activitySummaryTableColumns.ts    # Summary table columns + SummaryRowModel
│       │   └── activitySummaryListDTO.ts         # API → SummaryRowModel маппинг
│       └── index.ts
│
├── features/
│   ├── activity-filter/
│   │   ├── ui/
│   │   │   └── ActivityFilter.vue                # Фильтры: действие, статус, HTTP-код, дата
│   │   └── index.ts
│   │
│   └── activity-live/
│       ├── lib/
│       │   ├── useActivityLive.ts                # WS: подписка на account-activity.{accountId}
│       │   └── useGlobalActivityLive.ts          # WS: подписка на activity-global.{userId}
│       └── index.ts
│
├── widgets/
│   ├── activity-stats-cards/
│   │   ├── ui/ActivityStatsCards.vue             # 4 карточки: Всего, Сегодня, Ошибок, Успех%
│   │   └── index.ts
│   │
│   ├── activity-grouped-stats/
│   │   ├── ui/ActivityGroupedStats.vue           # Группировки: по действиям и по статусам
│   │   └── index.ts
│   │
│   ├── activity-log-table/
│   │   ├── ui/ActivityLogTable.vue               # Таблица с expandable rows + reverse scroll
│   │   ├── ui/ActivityLogExpandedRow.vue          # Раскрытая строка с JSON деталями
│   │   └── index.ts
│   │
│   ├── activity-summary-table/
│   │   ├── ui/ActivitySummaryTable.vue           # Таблица обзора аккаунтов
│   │   └── index.ts
│   │
│   └── activity-sidebar/
│       ├── ui/ActivitySidebar.vue                # Содержимое sidebar (список записей)
│       ├── ui/ActivitySidebarEntry.vue           # Одна запись (компактная карточка)
│       ├── ui/SidebarResizeHandle.vue            # Ручка для ресайза ширины
│       └── index.ts
│
├── pages/
│   └── logs/
│       ├── ui/LogsPage.vue                       # Страница логов (обзор + детализация)
│       └── index.ts
│
└── shared/
    └── lib/
        └── useReverseInfiniteScroll.ts           # Composable: обратный скролл с prepend
```

### Обновляемые файлы

| Файл | Что меняется |
|------|-------------|
| [MainLayout.vue](frontend-vue/src/layouts/MainLayout.vue) | + QDrawer (sidebar), + кнопка-триггер, + useGlobalActivityLive, + кнопка «Логи» в header |
| [routes.ts](frontend-vue/src/router/routes.ts) | + `/logs` и `/logs/:accountId` роуты |
| [echo.ts](frontend-vue/src/shared/lib/echo.ts) | Без изменений (уже настроен) |
| [InstagramClientService.php](backend-laravel/app/Services/InstagramClientService.php) | + DI ActivityLogger, + логирование каждого метода |
| [GenerateCommentJob.php](backend-laravel/app/Jobs/GenerateCommentJob.php) | + accountId, userId, + логирование |
| [CommentGenerateController.php](backend-laravel/app/Http/Controllers/CommentGenerateController.php) | + accountId, userId при dispatch |
| [channels.php](backend-laravel/routes/channels.php) | + 2 новых канала |
| [api.php](backend-laravel/routes/api.php) | + роуты для activity |
| [AppServiceProvider.php](backend-laravel/app/Providers/AppServiceProvider.php) | + bindings для ActivityLogger и ActivityLogRepository |
| [main.py](python-service/main.py) | + error_code в ответах, + HTTP status codes |

### Backend: новые файлы

```
backend-laravel/
├── app/
│   ├── Models/
│   │   └── AccountActivityLog.php
│   ├── Services/
│   │   ├── ActivityLoggerServiceInterface.php
│   │   └── ActivityLoggerService.php
│   ├── Repositories/
│   │   ├── ActivityLogRepositoryInterface.php
│   │   └── ActivityLogRepository.php
│   ├── Events/
│   │   └── ActivityLogCreated.php
│   ├── Http/Controllers/
│   │   └── ActivityLogController.php
│   └── Console/Commands/
│       └── PruneActivityLogs.php
├── database/migrations/
│   └── xxxx_xx_xx_create_account_activity_logs_table.php
│
python-service/
└── utils.py                                       # error_to_code() маппинг
```

---

## 11. Порядок реализации

### Этап A: Backend — хранение и API (без WebSocket)

| # | Задача | Файлы | Зависит от |
|---|--------|-------|-----------|
| A1 | Миграция `create_account_activity_logs_table` (с `http_code`, `endpoint`) | migration | — |
| A2 | Модель `AccountActivityLog` | Models/ | A1 |
| A3 | `ActivityLoggerServiceInterface` + `ActivityLoggerService` | Services/ | A2 |
| A4 | `ActivityLogRepositoryInterface` + `ActivityLogRepository` (cursor, around_id) | Repositories/ | A2 |
| A5 | DI binding в AppServiceProvider | Providers/ | A3, A4 |
| A6 | `ActivityLogController` (index, stats, summary) + routes | Controllers/, routes/ | A4, A5 |
| A7 | Python: `error_to_code()` + HTTP status codes | python-service/ | — |
| A8 | Интеграция ActivityLogger в `InstagramClientService` | Services/ | A3, A5 |
| A9 | Интеграция в `GenerateCommentJob` + `CommentGenerateController` | Jobs/, Controllers/ | A3, A5 |
| A10 | `PruneActivityLogs` command + schedule | Console/ | A4 |

### Этап B: Backend — WebSocket broadcasting

| # | Задача | Файлы | Зависит от |
|---|--------|-------|-----------|
| B1 | `ActivityLogCreated` event (ShouldBroadcast, два канала) | Events/ | A3 |
| B2 | Авторизация каналов в `channels.php` | routes/ | B1 |
| B3 | Dispatch event из `ActivityLoggerService.log()` | Services/ | B1 |

### Этап C: Frontend — entity и store

| # | Задача | Файлы | Зависит от |
|---|--------|-------|-----------|
| C1 | `entities/activity-log` (types, apiTypes, constants) | entities/ | — |
| C2 | `activityLogStore` (Pinia: API + cursor + prepend/append) | entities/ | C1 |
| C3 | `sidebarActivityStore` (Pinia: FIFO entries, open/width state) | entities/ | C1 |
| C4 | DTO + columns (log table + summary table) | entities/ | C1 |

### Этап D: Frontend — страница логов

| # | Задача | Файлы | Зависит от |
|---|--------|-------|-----------|
| D1 | `shared/lib/useReverseInfiniteScroll` composable | shared/ | — |
| D2 | `features/activity-filter/ActivityFilter.vue` | features/ | C1 |
| D3 | `widgets/activity-stats-cards/ActivityStatsCards.vue` | widgets/ | C2 |
| D4 | `widgets/activity-grouped-stats/ActivityGroupedStats.vue` | widgets/ | C2 |
| D5 | `widgets/activity-log-table/ActivityLogTable.vue` (expandable rows) | widgets/ | C4, D1 |
| D6 | `widgets/activity-log-table/ActivityLogExpandedRow.vue` | widgets/ | D5 |
| D7 | `widgets/activity-summary-table/ActivitySummaryTable.vue` | widgets/ | C4 |
| D8 | `pages/logs/LogsPage.vue` (обзор + детализация) | pages/ | D2-D7 |
| D9 | Router: `/logs`, `/logs/:accountId` | router/ | D8 |

### Этап E: Frontend — WebSocket + real-time

| # | Задача | Файлы | Зависит от |
|---|--------|-------|-----------|
| E1 | `features/activity-live/useActivityLive.ts` | features/ | C2, B2 |
| E2 | `features/activity-live/useGlobalActivityLive.ts` | features/ | C3, B2 |
| E3 | Интеграция `useActivityLive` в LogsPage | pages/ | D8, E1 |
| E4 | Бэдж «↓ N новых записей» + auto-scroll в ActivityLogTable | widgets/ | D5, E1 |

### Этап F: Frontend — Sidebar

| # | Задача | Файлы | Зависит от |
|---|--------|-------|-----------|
| F1 | `widgets/activity-sidebar/ActivitySidebarEntry.vue` | widgets/ | C1 |
| F2 | `widgets/activity-sidebar/SidebarResizeHandle.vue` | widgets/ | — |
| F3 | `widgets/activity-sidebar/ActivitySidebar.vue` | widgets/ | C3, F1, F2 |
| F4 | Интеграция в MainLayout (QDrawer + кнопка + useGlobalActivityLive) | layouts/ | F3, E2 |
| F5 | Клик по записи → навигация на LogsPage с `?highlight=id` | widgets/ | D8, F3 |
| F6 | Подсветка якорной строки на LogsPage (`?highlight`) | pages/ | D5 |

### Этап G: Стилизация и полировка

| # | Задача |
|---|--------|
| G1 | Стилизация бэджей (action, status, http_code) — единый стиль |
| G2 | Анимация новых записей (fade-in) в таблице и sidebar |
| G3 | Адаптивность: мобильный вид sidebar (fullscreen drawer) |
| G4 | Persistence ширины sidebar в localStorage |
| G5 | Тёмные/светлые стили для JSON в expanded row |
| G6 | Индикатор WebSocket подключения (● зелёная точка) |

---

## Приложение: сводка отличий от существующих планов

### PLAN-EXTEND-LOGGING-BACKEND.md — что добавлено

| Раздел | Добавлено |
|--------|----------|
| Схема БД | + `http_code` (smallInteger), + `endpoint` (string) |
| ActivityLoggerService | + параметры `httpCode`, `endpoint` |
| ActivityLogController.index | + `after_id`, `around_id`, `http_code` query params |
| ActivityLogCreated event | + `broadcastOn()` возвращает массив из двух каналов |
| channels.php | + канал `activity-global.{userId}` |
| Python | + HTTP status codes (не только JSON `success: false`) |

### PLAN-EXTEND-LOGGING-FRONT.md — что изменено

| Раздел | Было | Стало |
|--------|------|-------|
| Страницы | MonitoringPage + MonitoringDetailPage | LogsPage (единая, 2 режима) |
| Роуты | `/monitoring`, `/monitoring/:accountId` | `/logs`, `/logs/:accountId` |
| Таблица логов | Плоская + «Загрузить ещё» | Expandable rows + reverse infinite scroll |
| WebSocket | `useActivityLive` (1 канал) | + `useGlobalActivityLive` (глобальный канал) |
| Sidebar | Не было | Полный раздел (ActivitySidebar + store + composable) |
| Store | 1 store (activityLogStore) | + sidebarActivityStore |
| Якоря | Не было | `?highlight=logId` + around_id API |
| Колонки таблицы | 6 колонок | + httpCode, + endpoint, + expand toggle |
