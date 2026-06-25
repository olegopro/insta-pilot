# Витрина — Handoff (как безопасно закрыть чат и вернуться)

> **Весь материал в одном месте: что сделано, как сделано, карта файлов и как продолжить.**
> Чат можно закрывать — ничего не потеряется. Живое состояние плана — [`README.md`](README.md) §«Состояние плана».

## TL;DR

- **Фазы 0, 1, 2 — готовы, проверены живьём** (тесты + UI-скриншоты Playwright), закоммичены на `main` (10 showcase-коммитов).
- Все showcase-коммиты — **строго по своим путям**, изолированы от параллельной automation-задачи (другой терминал). Конфликтов нет.
- **Рабочее дерево ЧИСТОЕ — всё закоммичено** (`git status` пустой). `routes/api.php` (showcase-роуты + automation clone/destroy) и `retrospective.md` — в коммите `49d7704`; automation-фича (клонирование/фаза парсинга/UX) — в `f54a080`. Конфликтов нет.
- Codex весь день недоступен (402); реализацию делали Kiro-делегаты, независимое мнение — Context7.

## Что сделано (по фазам)

| Фаза | Что | Статус | Ключевые коммиты |
|---|---|---|---|
| 0 — verify | Live-проверка IG-операций (reversible verify-скрипт) | ✅ read-only доказано на живом аккаунте | `ced8489`, `5dba2da` |
| 1 — сетка профиля | Phone-simulator: профиль владельца + сетка своих постов (read-only) | ✅ собрана + UI-скриншот | `a514d91`, `18d4dbe` |
| 2 — overlay | Локальная обёртка (БД) + доска/drag + рабочая область (заметка, локальное скрытие) | ✅ собрана + UI-скриншот | `2bb0d72` |

Что реально работает (проверено): свой профиль (аватар/bio/счётчики), сетка 3-в-ряд с превью, клик→выбор поста в рабочую область, кнопки «Заметка»/«Скрыть локально», drag-перестановка (локальная доска), таб «Витрина». Backend **33** теста, FE **18** тестов, `vue-tsc`+`eslint` чисто, **0 console-ошибок** в UI.

## Как сделано (механика)

1. **Контракты заморожены ДО кода** — [`api-contracts.md`](api-contracts.md) (Python↔Laravel↔Vue). Это удержало слои при параллельном fan-out без рассинхрона.
2. **Реализация — fan-out Kiro-делегатами** (`claude-opus-4.8`/`max`) по непересекающимся слоям (Python / Laravel / Frontend). Швы (роуты, `router/routes.ts`, `AppNavTabs`, `AppServiceProvider`, миграции, `package.json`) держит оркестратор.
3. **Верификация фактом** (не по summary): BE/PY/FE тесты + Playwright live-check со скриншотами, которые оркестратор смотрел сам.
4. **Граблины пойманы живой проверкой:** python без `--reload` (после правок — `docker compose restart python`); превью грузились `lazy` → исправлено на `eager`; контент гейтился спиннером профиля → сетка теперь рендерится независимо.

## Карта файлов — committed / uncommitted / local (КЛЮЧЕВОЕ, чтобы не конфликтовать)

### ✅ Закоммичено на `main` (изолировано, additive — конфликтов с automation нет)

10 коммитов: `ce33d60` `ced8489` `0cbbecd` `5dba2da` `a514d91` `869d099` `18d4dbe` `bf4e578` `2bb0d72` `cf463ed`.

Затронутые **только showcase-пути**:
- `docs/showcase/**`
- `python-service/` — `main.py`, `helpers.py`, `schemas.py`, `tests/**`, `scripts/verify_showcase_ops.py`
- `backend-laravel/app/` — `Http/Controllers/Showcase*.php`, `Models/ShowcaseMediaOverlay.php`, `Repositories/ShowcaseOverlay*.php`, `Services/InstagramClientService*.php` (+ showcase-методы), `Providers/AppServiceProvider.php` (только showcase-bind)
- `backend-laravel/database/migrations/2026_06_25_000001_create_showcase_media_overlays_table.php`
- `backend-laravel/tests/**Showcase**`
- `frontend-vue/src/` — `entities/showcase-media/**`, `widgets/{phone-frame,showcase-grid,showcase-work-area}/**`, `features/{edit-showcase-note,reorder-showcase-grid}/**`, `pages/showcase/**`, `router/routes.ts` (+`/showcase`), `layouts/AppNavTabs.vue` (+«Витрина»)
- `frontend-vue/package.json` + `package-lock.json` (+`vuedraggable`)

### ✅ ЗАКОММИЧЕНО — `backend-laravel/routes/api.php` (`49d7704`)

Ранее был единственным незакоммиченным общим файлом; теперь закоммичен вместе с `retrospective.md` (showcase-роуты + automation clone/destroy в одном коммите). Showcase-роуты для справки (если когда-нибудь понадобится восстановить):

Импорты (среди `use App\Http\Controllers\*`):
```php
use App\Http\Controllers\ShowcaseController;
use App\Http\Controllers\ShowcaseOverlayController;
```
Группа (внутри `Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(...)`, рядом с `feed`):
```php
    // Showcase (Витрина) — собственный профиль/сетка
    Route::prefix('showcase')->group(function () {
        Route::get('/{accountId}/profile', [ShowcaseController::class, 'profile']);
        Route::get('/{accountId}/medias', [ShowcaseController::class, 'medias']);
        Route::get('/{accountId}/media/{mediaPk}', [ShowcaseController::class, 'mediaInfo']);
        Route::patch('/{accountId}/media/{mediaPk}/overlay', [ShowcaseOverlayController::class, 'updateOverlay']);
        Route::put('/{accountId}/board/order', [ShowcaseOverlayController::class, 'reorderBoard']);
    });
```

### ✅ ЗАКОММИЧЕНО — automation-фича (`f54a080`)

Параллельная задача (другой терминал) — клонирование/перепарс задач + индикатор фазы парсинга + UX карточек: `app/{Jobs,Http/Controllers,Repositories,Models,Events}/Automation*` и связанное, `frontend-vue/src/**/automation*`. Закоммичена отдельным `feat(automation)` (showcase-коммиты её не включали; verify — BE 300 / FE 461 тестов зелёные).

### 📦 Local-only (gitignored — в репо НЕ попадут; содержат секреты)

- `_TEST/session.json`, `_TEST/sc-token.txt`, `python-service/_TEST/session.json`, `backend-laravel/session_2.json`, `backend-laravel/storage/app/sctoken.txt` — сессия IG / Sanctum-токены, **чувствительные**, можно удалить (регенерируются по `../debug-protocol.md`).
- `frontend-vue/scripts/live-check/showcase-live.mjs` (+ `.png` скриншоты) — Playwright live-check (как `automation-live.mjs`), локальный.

## Как проверить, что всё работает

```bash
# миграция (если свежее окружение)
docker compose exec laravel php artisan migrate
# тесты
docker compose exec laravel php artisan test --filter Showcase     # 33 passed (1 skipped)
docker compose exec vue npx vitest run src/entities/showcase-media  # 18 passed
docker compose exec vue npx vue-tsc --noEmit                        # 0 showcase-ошибок
# live UI (с хоста): токен в _TEST/sc-token.txt (минт: User::find(1)->createToken(...))
SC_TOKEN=$(cat _TEST/sc-token.txt) SC_ACCOUNT=2 SC_WAIT_MS=120000 node frontend-vue/scripts/live-check/showcase-live.mjs
```
⚠️ После правок `python-service/*.py` — `docker compose restart python` (uvicorn без `--reload`).

## Как продолжить (следующие фазы)

- **Phase 3 — реальные IG-мутации** (edit подписи / archive / delete / pin). Это первое, что **меняет реальный аккаунт**. Нужен `media_pk` + явное ОК на reversible-мутации живого поста. Verify-скрипт готов: `docker compose exec python python scripts/verify_showcase_ops.py /app/_TEST/session.json --mutate --media-pk <PK>`. Детали — [`phases/phase-3-mutations.md`](phases/phase-3-mutations.md).
- **Phase 4 — пометка «реклама»/tracked** — overlay-флаги (`is_ad`/`is_tracked`) уже в БД и контроллере; нужен только FE-тоггл/бейдж/фильтр. Делается автономно. [`phases/phase-4-ads-autopost.md`](phases/phase-4-ads-autopost.md).
- **Phase 5 — аналитика.** ВАЖНО: тестовый аккаунт оказался **бизнес/проф** — `insights_media_feed_all` отдаёт реальные insights (reach/impressions/saves). Значит можно полноценную аналитику, не только counts-lite. [`phases/phase-5-analytics.md`](phases/phase-5-analytics.md).

## Kiro-сессии (для resume конкретного слайса через `reply`)

- Python (P1): `3d82460e-1c26-4afa-9383-ebbdd08c118f` (workdir `python-service`)
- Laravel (P1): `68f23a34-bc43-400e-9aee-d0058edefb84` (workdir `backend-laravel`)
- Frontend (P1): `02a3bd07-974a-4f80-984e-621ad183b125` (workdir `frontend-vue`)
- Laravel overlay (P2): `338dffe0-ef48-47a8-aa67-c131468d4c2b` (workdir `backend-laravel`)
- Frontend overlay (P2): `a449aa7d-c3e9-4c2e-9ce5-6e0bdcc134ce` (workdir `frontend-vue`)

## Заметки

- Тест-аккаунт `desyatnikov_666` (id=2) — `is_active=0`, периодически ловит 429 на `user_info` → счётчики профиля иногда 0 (код деградирует gracefully через `account_info`-фолбэк). На здоровом аккаунте — полные.
- Drag end-to-end в Playwright не симулировался (сложно), но покрыт unit-тестами (store `reorderBoard`/`buildBoardOrder`) + backend feature-тестом `/board/order`; рендер и клик→select проверены скриншотом.
