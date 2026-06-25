# Контракты «Витрины» (заморожены до fan-out)

> Durable-урок №1: точные пути/методы/payload/формат ответа фиксируются ДО делегирования — иначе
> рассинхрон всплывает живыми 500-ми. Менять только согласованно во всех трёх слоях.
> Формат Laravel-ответа везде: `{ success: bool, data: …, message? }` (ошибка — `{success:false, error}`).

## Соглашения

- `accountId` — id строки `instagram_accounts` (НЕ IG pk). Везде в path. Ownership — `findByIdAndUser`.
- `media_pk` — числовой IG pk (строкой). `media_id` — составной `{media_pk}_{owner_user_pk}`.
- Laravel→Python: `session_data` (JSON-строка из аккаунта) всегда в теле; Python никогда не получает `accountId`.
- Все Laravel-роуты — под `auth:sanctum` + `EnsureUserIsActive`, префикс `api/showcase`.

## Реестр endpoint'ов

| # | Действие | Vue → Laravel | Laravel → Python | Python → instagrapi | Фаза |
|---|---|---|---|---|---|
| 1 | Профиль владельца | `GET /showcase/{accountId}/profile` | `POST /profile/info` | `user_info(cl.user_id)` | 1 |
| 2 | Сетка постов (+overlay) | `GET /showcase/{accountId}/medias?cursor=&amount=` | `POST /profile/medias` | `user_medias_paginated(cl.user_id, amount, end_cursor)` | 1 |
| 3 | Свежий снимок поста | `GET /showcase/{accountId}/media/{mediaPk}` | `POST /media/info` | `media_info_v1(media_pk)` | 1/3 |
| 4 | Обновить overlay | `PATCH /showcase/{accountId}/media/{mediaPk}/overlay` | — (локально) | — | 2 |
| 5 | Переупорядочить доску | `PUT /showcase/{accountId}/board/order` | — (локально) | — | 2 |
| 6 | Редактировать подпись | `PATCH /showcase/{accountId}/media/{mediaPk}/caption` | `POST /media/edit` | `media_edit(media_id, caption, …)` | 3 |
| 7 | Скрыть (archive) | `POST /showcase/{accountId}/media/{mediaPk}/archive` | `POST /media/archive` | `media_archive(media_id)` | 3 |
| 8 | Показать (unarchive) | `POST /showcase/{accountId}/media/{mediaPk}/unarchive` | `POST /media/unarchive` | `media_unarchive(media_id)` | 3 |
| 9 | Удалить | `DELETE /showcase/{accountId}/media/{mediaPk}` | `POST /media/delete` | `media_delete(media_id)` | 3 |
| 10 | Закрепить | `POST /showcase/{accountId}/media/{mediaPk}/pin` | `POST /media/pin` | `media_pin(media_pk)` / `clip_pin` | 3 |
| 11 | Открепить | `POST /showcase/{accountId}/media/{mediaPk}/unpin` | `POST /media/unpin` | `media_unpin(media_pk)` / `clip_unpin` | 3 |
| 12 | Архив (список) | `GET /showcase/{accountId}/archived` | `POST /profile/archived` | `archive_medias(amount)` | 3 |
| 13 | Insights (бизнес) | `GET /showcase/{accountId}/insights` | `POST /profile/insights` | `insights_media_feed_all(...)` | 5 |

## Формы данных (заморожены; точные поля Python-ответа уточняет Phase 0)

### `ShowcaseProfile` (#1)
```jsonc
{
  "user_pk": "123",          // строка
  "username": "...",
  "full_name": "...",
  "profile_pic_url": "...",  // прогнать через proxyImageUrl на фронте
  "biography": "...",
  "media_count": 0,
  "follower_count": 0,
  "following_count": 0,
  "is_private": false,
  "is_verified": false
}
```

### `ShowcaseMedia` (элемент #2 — IG-факт + overlay)
IG-факт — как `MediaPostApi` (переиспользуем сериализацию ленты) плюс блок `overlay`:
```jsonc
{
  // ── IG-факт (из user_medias, серилизатор как у ленты) ──
  "pk": "...", "id": "{pk}_{user_pk}", "code": "...",
  "media_type": 1, "taken_at": "...",
  "thumbnail_url": "...", "thumbnail_width": 0, "thumbnail_height": 0,
  "video_url": null, "resources": [],
  "caption_text": "...", "like_count": 0, "comment_count": 0, "view_count": 0,
  "is_pinned": false,        // ← как IG отдаёт pinned — зафиксировать в Phase 0
  // ── overlay (локально; дефолты если строки нет) ──
  "overlay": {
    "board_position": null,
    "is_ad": false, "is_tracked": false, "is_hidden_local": false,
    "note": null, "labels": null
  }
}
```
Ответ #2: `{ success, data: { posts: ShowcaseMedia[], next_cursor: string|null, more_available: bool } }`.

### Обновить overlay (#4) — тело PATCH
```jsonc
// любое подмножество полей; null/отсутствие — не менять
{ "is_ad": true, "is_tracked": true, "is_hidden_local": false, "note": "…", "labels": ["x"] }
```
Ответ: `{ success, data: { overlay: {...} } }`. Строка создаётся лениво (findOrNew).

### Переупорядочить доску (#5) — тело PUT
```jsonc
{ "order": [ { "media_pk": "111", "position": 0 }, { "media_pk": "222", "position": 1 } ] }
```
Ответ: `{ success }`. Батч-апдейт `board_position` в одной транзакции.

### Редактировать подпись (#6) — тело PATCH
```jsonc
{ "caption": "новый текст" }
```
Laravel→Python `/media/edit`: `{ session_data, media_id, caption }`. Ответ Python: `{ success, media_id }`
(+ `debug_info`). На фронте — затем перетянуть `/media/{mediaPk}` для подтверждения после refresh.

### archive/unarchive/delete/pin/unpin (#7–#11)
Laravel→Python тело: `{ session_data, media_id }` (для pin/unpin — `{ session_data, media_pk }`).
Ответ Python: `{ success: bool }` (+ `debug_info`). Laravel-ответ: `{ success, message }`.
`delete` — необратимо; контроллер требует подтверждённый флаг в теле (`{ "confirm": true }`).

## ActivityLog actions (новые строки)

`fetch_own_profile`, `fetch_own_medias`, `fetch_media_info`, `edit_media`, `archive_media`,
`unarchive_media`, `delete_media`, `pin_media`, `unpin_media`, `fetch_archived` (+ Phase 5 `fetch_insights`).
Пишутся автоматически внутри методов `InstagramClientService` (3-слойная debug-сводка как у `like`/`comment`).

## Открытые места, которые закрывает Phase 0

- Точный набор полей в ответе `user_medias_paginated` и **как отдаётся `is_pinned`**.
- Реальный путь сериализации своих постов (`media.dict()`-адаптер vs `private_request feed/user/{pk}/`).
- Принимает ли `media_edit` usertags/location на уже опубликованном посте (для будущего расширения #6).
