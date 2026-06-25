# Архитектура «Витрины»

> Слои, канонические решения, швы и карта переиспользования. Контракты — заморожены ДО fan-out
> (durable-урок №1 ретроспективы). Точные пути/payload/формат ответа — в [`api-contracts.md`](api-contracts.md).

## 1. Что строим

Новый user-level раздел «Витрина» поверх существующих примитивов проекта (рендер медиа-сетки,
слой Vue↔Laravel↔Python, ownership, ActivityLog). Laravel ничего нового про Instagram не «умеет» —
оркеструет: тянет профиль/посты владельца через Python, держит локальную обёртку (overlay) в БД,
проксирует реальные мутации в IG.

```
[Vue: phone-simulator + work area] → [Laravel: proxy + overlay-БД] → [Python FastAPI] → [Instagram]
        ↑ drag/ad/hidden/note (локально)        ↓ edit/archive/delete/pin (реально в IG)
   showcase_media_overlays (board_position, is_ad, is_hidden_local, note, tracked)
```

Две сущности на один пост:
- **IG-факт** — эфемерный снимок поста из `user_medias` (caption, counts, thumbnail, pinned). Не храним как источник правды, тянем по запросу + кэшируем снимок в overlay.
- **overlay** — локальная строка `showcase_media_overlays` (наша «умная обёртка»): позиция-доски, пометки, заметка. Источник правды для планировщика.

`ShowcaseMedia` (то, что видит фронт) = слияние IG-факта и overlay по `media_pk`.

## 2. Канонические решения (заморожены — НЕ нарушать)

| # | Вопрос | Решение | Почему |
|---|--------|---------|--------|
| 1 | Порядок сетки в IG | Невозможен. Drag → только локальный `board_position`; реальный порядок — лишь `media_pin` (≤3). | Доказано (feasibility): IG не даёт reorder-API. |
| 2 | Источник постов | `user_medias`/`user_medias_paginated(cl.user_id)`, НЕ `/account/feed`. | `/account/feed` — ЧУЖАЯ домашняя лента, не своя сетка. |
| 3 | Слияние данных | overlay keyed by `(instagram_account_id, media_pk)`; left-join к IG-постам. Нет overlay → дефолты (position=null, флаги=false). | Overlay не обязан существовать для каждого поста; создаётся лениво при первой пометке/перетаскивании. |
| 4 | «Скрыть» | Два разных действия: `is_hidden_local` (локально, только наш UI) И `media_archive` (реально из профиля). В UI развести явными подписями. | Пользователь может прятать в плане, не трогая аккаунт; или реально архивировать. |
| 5 | Идентификатор | `media_pk` (числовой, хранится строкой) — ключ overlay; `media_id` (составной `{pk}_{userpk}`) — для методов, что его требуют (`media_edit`/`archive`/`delete`). `media_pin` берёт `media_pk`. | Совпадает с конвенцией проекта (`_pk` vs `_id`). |
| 6 | Мутации — синхронные | Edit/archive/delete/pin — синхронный HTTP Laravel→Python→IG (без очереди), как существующие `like`/`comment`. Bulk — позже, при необходимости очередь. | Одиночные действия дёшевы; очередь движка автоматизации здесь не нужна. |
| 7 | DnD-библиотека | `vuedraggable@4` (sortablejs, Vue3). Добавляется в `package.json` оркестратором (seam). | В репо DnD нет; `MasonryGrid` — display-only. |
| 8 | Доступ | user-level (по владельцу аккаунта через `findByIdAndUser`), не admin. | Как лента/поиск/автоматизация. |
| 9 | Аналитика на личном аккаунте | counts-lite (агрегаты публичных счётчиков + динамика снимков), НЕ `insights_*`. | `insights_*` требуют бизнес-аккаунт. |

## 3. Python-слой (`python-service/`)

Тонкий прокси к instagrapi по паттерну существующих endpoint'ов. Все: `account_lock(session_data)`,
`asyncio.to_thread`, предсказуемый error-ответ (без traceback наружу), `debug_info` для ActivityLog,
без логирования чувствительного. Сериализация постов — переиспользовать `_serialize_media`.

Новые endpoint'ы (точные сигнатуры — `api-contracts.md`):
- `POST /profile/info` — `cl.user_info(cl.user_id)` → профиль владельца.
- `POST /profile/medias` — `cl.user_medias_paginated(cl.user_id, amount, end_cursor)` → сетка + курсор.
- `POST /media/info` — `cl.media_info_v1(media_pk)` → свежий снимок поста (для refresh-verify).
- `POST /media/edit` — `cl.media_edit(media_id, caption, …)`.
- `POST /media/archive` / `POST /media/unarchive` — `cl.media_archive/unarchive(media_id)`.
- `POST /profile/archived` — `cl.archive_medias(amount)`.
- `POST /media/delete` — `cl.media_delete(media_id)`.
- `POST /media/pin` / `POST /media/unpin` — `cl.media_pin/unpin(media_pk)` (Reels — clip-варианты).
- `POST /profile/insights` (Phase 5, guarded) — `cl.insights_media_feed_all(...)`.

Helpers: `_serialize_own_media` (адаптер выбранного в Phase 0 пути), при необходимости `_serialize_owner_profile`.

## 4. Laravel-слой (`backend-laravel/`)

### 4.1 Клиент IG (`InstagramClientService` + интерфейс)
Новые методы по образцу `addLike`/`commentMedia` (Http-вызов, `duration_ms`, `activityLogger->log`,
`detectStatus`, `maybeDeactivateAccount`): `getOwnProfile`, `getOwnMedias`, `getMediaInfo`, `editMedia`,
`archiveMedia`, `unarchiveMedia`, `getArchivedMedias`, `deleteMedia`, `pinMedia`, `unpinMedia` (+ позже
`getProfileInsights`). Все принимают явный `?int $userId` где нужно (auth-context-free, как в §2.3
автоматизации) — на будущее, если уйдут в очередь.

### 4.2 Overlay (локальная обёртка)
- Модель `ShowcaseMediaOverlay` (таблица — `data-model.md`).
- Репозиторий `ShowcaseOverlayRepositoryInterface` + impl, bind в `AppServiceProvider`.
- `findOrNew(accountId, mediaPk)`, `upsertFlags(...)`, `reorder(accountId, [{media_pk, position}])`.

### 4.3 Контроллеры (`final`, JsonResponse, ownership через `findByIdAndUser`)
- `ShowcaseController` — `profile()`, `medias()` (тянет IG-посты, мёрджит overlay).
- `ShowcaseMediaController` — мутации IG: `editCaption`, `archive`, `unarchive`, `delete`, `pin`, `unpin`.
- `ShowcaseOverlayController` — локальный overlay: `updateOverlay` (ad/hidden/note/labels/tracked), `reorderBoard`.
- (Phase 5) `ShowcaseAnalyticsController`.

### 4.4 ActivityLog
Мутации логируются автоматически внутри методов `InstagramClientService` (новые actions:
`fetch_own_profile`, `fetch_own_medias`, `edit_media`, `archive_media`, `unarchive_media`,
`delete_media`, `pin_media`, `unpin_media`). Фронт-фильтры активности работают без правок.
Локальные overlay-операции IG не дёргают — их в ActivityLog НЕ пишем (или пишем отдельным
не-IG action при необходимости аудита).

## 5. Frontend-слой (Vue 3 + Quasar + FSD)

```
pages/showcase/                 ShowcasePage.vue — phone-simulator + work area (+ таб Аналитика в Phase 5)
entities/showcase-media/        ShowcaseProfile/ShowcaseMedia (IG-факт + overlay), DTO, showcaseStore, constants
features/
  edit-media-caption/           модалка → PATCH caption (Phase 3)
  toggle-media-archive/         скрыть/показать реально (Phase 3)
  delete-media/                 удалить (Phase 3, подтверждение)
  pin-media/                    закрепить/открепить ≤3 (Phase 3)
  reorder-showcase-grid/        drag сетки → board_position (Phase 2, vuedraggable)
  edit-showcase-note/           заметка к посту (Phase 2)
  mark-showcase-ad/             пометка реклама/tracked (Phase 4)
widgets/
  phone-frame/                  PhoneFrame.vue — «рамка телефона»: шапка профиля + слот сетки
  showcase-grid/                ShowcaseGrid.vue — 3-в-ряд (reuse MediaCard) + бейджи pin/ad + hidden-стиль + drag
  showcase-work-area/           ShowcaseWorkArea.vue — нижняя рабочая область (детали/редактор выбранного поста)
  showcase-analytics/           Phase 5
```

Переиспользуется: `MediaCard`, `MediaDisplay`, `mediaPostDTO`, `MEDIA_TYPE`, `proxyImageUrl`, `MasonryGrid`
(для нередактируемого вида), `AccountSelectComponent`/`useAccountSelect`, `TableComponent`, `useApi`,
`useModal`, `notify`, паттерн store. Новый профиль владельца — расширить `InstagramUserDetail` или новый
`ShowcaseProfile` (счётчики/bio/avatar по `user_info(cl.user_id)`).

## 6. Швы (держит оркестратор — НЕ делегировать враздрай)

- `src/router/routes.ts` — child-route `/showcase` под `MainLayout` (user-level).
- `src/layouts/AppNavTabs.vue` — `q-route-tab to="/showcase" label="Витрина"`.
- `backend-laravel/routes/api.php` — группа `/showcase/...` под `auth:sanctum` + `EnsureUserIsActive`.
- `backend-laravel/app/Providers/AppServiceProvider.php` — bind `ShowcaseOverlayRepositoryInterface`.
- Миграция `create_showcase_media_overlays_table`.
- `frontend-vue/package.json` — `vuedraggable@^4`.
- Вложенный `frontend-vue/src/pages/showcase/CLAUDE.md` (или в widgets) — area-специфика «Витрины».
- Эти доки + указатель в корневом `CLAUDE.md`.

## 7. Карта переиспользования (что НЕ пишем заново)

- `InstagramClientService` — единственная точка IG; новые методы по образцу `addLike`/`commentMedia`.
- `ActivityLoggerService` + 3-слойная debug-сводка + `maybeDeactivateAccount` — автоматически.
- `proxyImageUrl` — IG CDN требует прокси картинок (DTO уже прогоняет).
- `_serialize_media` / `_make_client` / `account_lock` (Python) — основа новых endpoint'ов.
- `MediaCard`/`MediaDisplay`/`MasonryGrid`/`mediaPostDTO` (Vue) — рендер сетки и деталей поста.
- Паттерн ownership (`findByIdAndUser`) — во всех контроллерах.

## 8. Realtime

Для v1 не нужен — мутации синхронные, долгих job нет. Если появится bulk-операция (массовый
archive/pin) — добавить `ShowcaseBulkProgress` по образцу `AutomationTaskProgress` (отдельная фаза).
