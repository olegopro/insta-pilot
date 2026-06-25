# Debug-protocol — операции «Витрины» (расширение `../../debug-protocol.md`)

> Конкретные команды для ручной/скриптовой проверки endpoint'ов «Витрины» на живом аккаунте.
> База (извлечение `session.json`, сравнение слоёв, нейминг `_TEST/`) — в [`../../debug-protocol.md`](../../debug-protocol.md).
> Rate-limit first: reversible-мутации только на согласованном посте, delete — только на расходном.

## Endpoint'ы Python (raw curl) — поля сверх `session_data`

| Endpoint | Поля | Фаза |
|---|---|---|
| `/profile/info` | — | 1 |
| `/profile/medias` | `amount` (opt), `end_cursor` (opt) | 1 |
| `/media/info` | `media_pk` | 1/3 |
| `/media/edit` | `media_id`, `caption` | 3 |
| `/media/archive` | `media_id` | 3 |
| `/media/unarchive` | `media_id` | 3 |
| `/profile/archived` | `amount` (opt) | 3 |
| `/media/delete` | `media_id` (⚠ необратимо) | 3 |
| `/media/pin` | `media_pk` | 3 |
| `/media/unpin` | `media_pk` | 3 |

Шаблон (как в базовом protocol):
```bash
jq -n --arg sd "$(cat _TEST/session.json)" '{session_data:$sd, amount:12}' | \
curl -s -X POST http://localhost:8001/profile/medias -H "Content-Type: application/json" -d @- \
  | jq . > _TEST/01_python_profile_medias.json
```

## Что проверять по сценариям

| # | Сценарий | Проверяем |
|---|---|---|
| 1 | Сетка своих постов | непустой `posts[]`, есть `next_cursor`; поля caption/counts/thumbnail; **как отдан `is_pinned`** |
| 2 | Профиль владельца | counts (media/follower/following), bio, avatar — совпадают с приложением |
| 3 | Снимок поста | `/media/info` совпадает с элементом сетки |
| 4 | Edit подписи (reversible) | до→после в `/media/medias` после правки; затем возврат исходной |
| 5 | Archive↔Unarchive | пост ушёл из `/profile/medias`, появился в `/profile/archived`, вернулся после unarchive |
| 6 | Pin↔Unpin | закрепление отражается; лимит ≤3; возврат после unpin |
| 7 | Insights (личный) | `/profile/insights` падает предсказуемой ошибкой → личный = counts-lite |

## Laravel HTTP (cURL + Bearer) — после реализации соответствующей фазы

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@insta-pilot.local","password":"password"}' | jq -r '.data.token')

curl -s "http://localhost:8000/api/showcase/<accountId>/medias?amount=12" \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" | jq . > _TEST/03_laravel_http_showcase_medias.json
```
Сверить: блок `overlay` присутствует у каждого поста (дефолты в Phase 1; наполнен в Phase 2+).

## Грабли

- Python кэширует клиента ~5 мин — при смене сессии: `docker compose restart python`.
- После правок `app/Jobs|Services` — рестарт воркеров (queue:work кэширует код).
- `_TEST/` в `.gitignore`; `session.json` чувствительный — не коммитить, не логировать.
- Мутации на ЖИВОМ аккаунте — только reversible и по согласию; delete — только на расходном посте.
