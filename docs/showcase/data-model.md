# Модель данных — локальная обёртка (overlay)

> Одна новая таблица. Конвенции проекта: `bigIncrements` PK, ownership `user_id` (cascadeOnDelete),
> привязка к аккаунту `instagram_account_id` (constrained), статусы/флаги — обычные колонки, json-cast
> для структурированных полей. Шифрование не требуется (креды живут в `instagram_accounts`).

## Таблица `showcase_media_overlays`

«Умная обёртка» поверх IG-поста: всё, что не хранит Instagram (план-порядок, пометки, заметки).
Создаётся **лениво** — строка появляется при первой пометке/перетаскивании поста, не для каждого поста.

| Поле | Тип | Описание |
|---|---|---|
| `id` | bigIncrements | PK |
| `instagram_account_id` | FK, constrained, cascadeOnDelete | чей профиль |
| `user_id` | FK, constrained, cascadeOnDelete | владелец системы (денорм. ownership) |
| `media_pk` | string | числовой IG media pk (строкой — конвенция instagrapi, без риска bigint) |
| `media_id` | string, nullable | составной `{media_pk}_{user_pk}` — для методов, что его требуют |
| `board_position` | integer, nullable | локальный порядок доски-планировщика; `null` = IG-хронология |
| `is_ad` | boolean, default false | пометка «реклама» |
| `is_tracked` | boolean, default false | отслеживаемый (реклама/будущая аналитика) |
| `is_hidden_local` | boolean, default false | локальное скрытие (только наш UI; ≠ IG-archive) |
| `is_pinned_cache` | boolean, default false | кэш реального pin-статуса из IG (для рендера без доп. запроса; правда — в IG) |
| `note` | text, nullable | заметка владельца |
| `labels` | json, nullable | произвольные метки/теги |
| `ig_snapshot` | json, nullable | кэш последнего снимка поста (caption, counts, thumbnail, media_type, taken_at, pinned) — оффлайн-рендер доски |
| `synced_at` | timestamp, nullable | когда последний раз синхронизирован снимок с IG |
| `created_at` / `updated_at` | timestamps | |

**Ключи и индексы:**
- UNIQUE `[instagram_account_id, media_pk]` — одна обёртка на пост в рамках аккаунта.
- index `[user_id, id]` — ownership-выборки.
- index `[instagram_account_id, board_position]` — упорядоченная выдача доски.
- index `[instagram_account_id, is_ad]` — фильтр рекламных.

## Семантика слияния «IG-пост + overlay → ShowcaseMedia»

Контроллер `ShowcaseController::medias`:
1. Тянет посты владельца из Python (`/profile/medias`) — массив IG-фактов (`media_pk`, caption, counts,
   thumbnail, media_type, resources, **pinned**).
2. Грузит overlay-строки аккаунта одним запросом, индексирует по `media_pk`.
3. Мёрджит: для каждого IG-поста — приклеивает overlay-поля (или дефолты, если строки нет). Параллельно
   обновляет `ig_snapshot` + `is_pinned_cache` + `synced_at` у существующих overlay (best-effort).
4. Сортировка выдачи: посты с `board_position != null` по позиции, остальные — IG-хронология следом
   (pinned-посты IG визуально маркируются бейджем, но в доске участвуют как обычные — порядок доски локальный).

**Правила консистентности:**
- Overlay **никогда не источник правды для контента** (caption/изображение) — только для план-метаданных.
  `ig_snapshot` — кэш для отрисовки, не авторитет; при открытии поста тянуть свежее (`/media/info`).
- При реальном `delete` поста в IG — overlay помечать «осиротевшим» (или удалять) в том же запросе.
- При реальном `archive` — пост уходит из `user_medias`; overlay остаётся (для возврата), помечается по
  снимку. Решение о судьбе осиротевших overlay — в Phase 3 (рекомендация: оставлять с флагом, чистить по кнопке).

## Что НЕ кладём в БД

- Контент постов (caption/картинки) как источник правды — он в IG, тянем по запросу.
- Креды/сессии — они в `instagram_accounts` (зашифрованы).
- Реальный pin-статус как авторитет — авторитет в IG; `is_pinned_cache` лишь ускоряет рендер.

## Будущие таблицы (НЕ в фундаменте)

- **Phase 4** (tracked/реклама расширенно): возможно `showcase_ad_records` (кампания, бюджет, ссылка) —
  решить при подходе к фазе; для MVP хватает `is_ad`/`is_tracked`/`labels` в overlay.
- **Phase 5** (аналитика): `showcase_media_metric_snapshots` (media_pk, дата, like/comment/view_count) —
  для динамики counts-lite во времени. Спроектировать при подходе к фазе.
