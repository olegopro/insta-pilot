# Витрина (`showcase`) — паутина документации

> **Диспетчер фичи «Витрина».** Редактор собственной сетки профиля в виде phone-simulator
> + локальная обёртка-планировщик над постами + реальные IG-мутации (edit / archive / delete / pin)
> + задел под аналитику. Этот файл — карта; механики и чек-листы — во вложенных доках.

- **Канонический слаг** кода / доков / scope коммитов — `showcase`. Раздел меню (user-facing) — **«Витрина»**.
- **Статус:** design. Реализация идёт строго по фазам (Phase 0 → 1 → …), каждая проверяется живьём ДО следующей.
- **Источник правды по решениям** — [`architecture.md`](architecture.md) §«Канонические решения». Вердикт
  осуществимости (что реально в IG, а что только локально) — [`feasibility.md`](feasibility.md).

## Состояние плана (актуально — читать первым)

> **Single source of truth по прогрессу многошагового плана.** В НОВОМ чате начинать отсюда: где
> остановились, что закоммичено, что следующее. **После каждого завершённого под-шага — обновлять
> таблицу и строку «Сейчас ждём».** Это и есть механизм продолжения диалога в новых сессиях.
>
> 📋 **Полный handoff** (что/как сделано + карта файлов committed/uncommitted, чтобы не конфликтовать с
> параллельной automation-задачей) — [`HANDOFF.md`](HANDOFF.md). Читать при возврате в новом чате.

**Ветка и коммиты.** Одна ветка (`main`), без отдельных feature-веток — владелец работает один,
синхронизация веток не нужна; работа идёт **параллельно** с его другими правками. Коммиты — **группами
по фазе/под-шагу**, conventional commits со scope `showcase`: `feat(showcase): …`, `docs(showcase): …`,
`test(showcase): …`. Стейджить **только showcase-пути** (`docs/showcase/`,
`python-service/scripts/verify_showcase_ops.py`, новые файлы фичи, строку-указатель в `CLAUDE.md`) —
НЕ захватывать параллельную работу владельца (`automation-*` и прочее в рабочем дереве).

**Легенда:** ⬜ не начато · 🟡 в работе · ✅ готово и проверено живьём · ⏸ ждёт гейта/решения.

| # | Фаза | Статус | Коммит | Что осталось до закрытия |
|---|------|--------|--------|--------------------------|
| — | Паутина доков | ✅ закоммичена | `ce33d60` | — |
| 0 | [verify](phases/phase-0-verify.md) | 🟡 read-only ✅, mutate ⏸ | `ced8489` | read-feasibility доказана живьём (12 постов, media_info, insights=бизнес; `user_info`→429); reversible edit/archive/pin ждут согласованный пост |
| 1 | [grid](phases/phase-1-grid.md) | ✅ собрана + live + UI-скриншот | `a514d91`, `18d4dbe` | ⚠ showcase-роут в `routes/api.php` НЕ закоммичен (общий с automation). UX-нюанс: контент гейтится профилем (на throttled-аккаунте долгий спиннер) — кандидат на доводку |
| 2 | [overlay](phases/phase-2-overlay.md) | ✅ собрана + live | `2bb0d72` | overlay-роуты (PATCH/PUT) в `routes/api.php` не закоммичены (общий файл); UX-фикс гейтинга профилем сделан здесь |
| 3 | [mutations](phases/phase-3-mutations.md) | ⬜ | — | |
| 4 | [ads/autopost](phases/phase-4-ads-autopost.md) | ⬜ | — | 4B автопостинг — опц. |
| 5 | [analytics](phases/phase-5-analytics.md) | ⬜ | — | 5B insights = бизнес (future) |

**Сейчас ждём:** выбор шага — **Phase 3** (реальные IG-мутации edit/archive/delete/pin; для live-проверки
нужен `media_pk`, можно совместить с Phase 0 mutate) ИЛИ **Phase 4** (пометка реклама/tracked — overlay-флаги
уже в БД). Phase 1–2 собраны и live-проверены (скриншоты). ⚠ `routes/api.php` (showcase GET+overlay роуты)
не закоммичены — общий файл, уйдут с automation-коммитом.

**Лог решений (свежие — сверху):**
- **2026-06-25** — Phase 2 ✅ (`2bb0d72`): fan-out Kiro ×2 (Laravel overlay + FE drag/work-area). FE-делегат **таймаутнул 600с** на store-тесте → дописан `reply`-resume (реализация уже была чистой: eslint+vue-tsc). Контракт-развилка путей (delegate-тест `/medias`+POST vs контракт `/media`+PUT) сведена оркестратором под заморозку. Live: клик→выбор поста в рабочую область, фикс гейтинга профилем, 0 console-ошибок. Laravel 33 / FE 18 тестов.
- **2026-06-25** — Phase 1 UI live-check (Playwright + скриншот): профиль + сетка работают, 12/12 превью грузятся, 0 console-ошибок. Поймал и пофиксил баг: `ShowcaseGrid` `loading=lazy → eager` (lazy давал пустые плитки в headless) — `18d4dbe`. Наблюдение: страница гейтит весь контент профилем (throttled-аккаунт → долгий спиннер); кандидат на UX-доводку (рендерить сетку независимо от профиля). Харнес `scripts/live-check/showcase-live.mjs` — gitignored (как `automation-live.mjs`), локальный.
- **2026-06-25** — Phase 1 ✅ (`a514d91`): fan-out Kiro ×3 (opus/max — Python/Laravel/FE по непересекающимся слоям), замороженный контракт удержан без рассинхрона. Проверено: Laravel 17 / Python 117 тестов, vue-tsc чисто по showcase, live-roundtrip (medias 6 постов, профиль graceful). Граблина: python без `--reload` → нужен рестарт контейнера, чтобы подхватить новые эндпоинты.
- **2026-06-25** — Phase 0 `--read-only` ✅ на live (аккаунт desyatnikov_666): own grid / `media_info_v1` / `_serialize_media` работают; `user_info(self)`→429 (брать `account_info`); `insights_media_feed_all` вернул реальные данные → аккаунт **бизнес/проф**. Детали — [`feasibility.md`](feasibility.md) §«Phase 0 — фактические результаты».
- **2026-06-25** — коммиты: `ce33d60` `docs(showcase)` (паутина + трекер), `ced8489` `chore(showcase)` (Phase 0 verify-скрипт); стейджились строго showcase-пути, параллельная automation-работа не затронута.
- **2026-06-25** — процесс: ветка одна (`main`), коммиты группами scope `showcase`; состояние плана ведётся в этом разделе (для продолжения в новых чатах).
- **2026-06-25** — развилки: архитектура = «доска-планировщик + реальные мутации»; объём = «фундамент по шагам»; меню «Витрина», slug `showcase`. Codex недоступен (402 `deactivated_workspace`).

## Карта документов

| Файл | Что внутри |
|---|---|
| [`HANDOFF.md`](HANDOFF.md) | **Handoff для возврата:** что/как сделано (фазы 0–2), карта файлов (committed / общий uncommitted `routes/api.php` / automation-WIP / local), как проверить и продолжить, Kiro-сессии. |
| [`feasibility.md`](feasibility.md) | Вердикт: какие IG-операции реальны и сохраняются, а что — только локальная обёртка. Таблица методов instagrapi (Context7). |
| [`architecture.md`](architecture.md) | Слои Python / Laravel / Vue, канонические решения, швы, карта переиспользования, что нового. |
| [`data-model.md`](data-model.md) | Таблица `showcase_media_overlays` (локальная обёртка) + семантика слияния «IG-пост + overlay → ShowcaseMedia». |
| [`api-contracts.md`](api-contracts.md) | Замороженные контракты: Python endpoints ↔ Laravel routes ↔ Vue DTO для каждого вызова. |
| [`phases/phase-0-verify.md`](phases/phase-0-verify.md) | **Сначала.** Live-проверка КАЖДОЙ IG-операции на реальном аккаунте (reversible) ДО кода. |
| [`phases/phase-1-grid.md`](phases/phase-1-grid.md) | Read-only phone-sim: профиль владельца + сетка своих постов (`user_medias`). |
| [`phases/phase-2-overlay.md`](phases/phase-2-overlay.md) | Локальная обёртка (БД) + рабочая область + drag (локальное сохранение порядка/пометок). |
| [`phases/phase-3-mutations.md`](phases/phase-3-mutations.md) | Реальные IG-мутации: edit / archive / delete / pin + «Сохранить → push» + проверка refresh. |
| [`phases/phase-4-ads-autopost.md`](phases/phase-4-ads-autopost.md) | Пометка «реклама» / tracked + (опц., отдельно) автопостинг. |
| [`phases/phase-5-analytics.md`](phases/phase-5-analytics.md) | Аналитика: counts-lite для личного аккаунта; полные insights = бизнес (future). |
| [`checklists/debug-protocol-profile.md`](checklists/debug-protocol-profile.md) | Расширение `../debug-protocol.md` под операции «Витрины». |

## Глоссарий

- **overlay / обёртка** — локальная строка `showcase_media_overlays` поверх IG-поста (позиция-доски, ad-флаг, hidden-local, заметка, tracked). Источник «умной обёртки над лентой».
- **board / доска** — локальный планируемый порядок сетки (результат drag). **НЕ влияет на IG** — это визуальный план, как в Later/Planoly.
- **pin** — реальное закрепление ≤3 постов сверху профиля в IG (`media_pin`/`media_unpin`). Единственный реальный рычаг порядка.
- **mutation / мутация** — операция, реально меняющая аккаунт: edit подписи, archive/unarchive (скрыть/показать), delete, pin/unpin.
- **tracked** — пост, помеченный для отслеживания (реклама / будущая аналитика). Локальный флаг.
- **showcase** — внутренний слаг фичи во всех слоях (БД, роуты, FSD-слайсы, scope коммитов).

## Принципы (инварианты — НЕ нарушать)

1. **Произвольный порядок сетки в IG невозможен.** Drag = локальная доска-планировщик; реальный порядок двигают только pin (≤3) и порядок публикации. Доказано офиц. докой instagrapi — см. `feasibility.md`.
2. **Rate-limit first.** Минимум IG-вызовов, reversible/batch-тесты, без массовых/агрессивных действий (универсальное правило проекта).
3. **Phase-gate.** Каждая фаза проверяется на живом аккаунте (debug-protocol) ДО старта следующей. Не строить UI поверх непроверенной механики.
4. **Разделение труда.** Швы (`router/routes.ts`, `AppNavTabs.vue`, `routes/api.php`, `AppServiceProvider`, миграции, `package.json`, эти доки) — оркестратор. Реализацию слайсов (`pages/widgets/features/entities`, `app/*` кроме Providers, `python-service/*.py`) — Kiro-делегаты.
5. **После правок `app/Jobs|Services` или python — рестарт воркеров** (`queue:work` кэширует код): `docker compose restart queue-worker automation-worker python`.

## Связанные доки проекта

- [`../debug-protocol.md`](../debug-protocol.md) — базовый чек-лист ручных проверок Python→Laravel.
- [`../automation/architecture.md`](../automation/architecture.md) — образец паттернов (слои, ownership, ActivityLog, realtime), частично переиспользуем.
- [`../orchestration/playbook.md`](../orchestration/playbook.md) / [`agent-factory.md`](../orchestration/agent-factory.md) — плейбук параллельного делегирования.
- [`../orchestration/retrospective.md`](../orchestration/retrospective.md) — живой лог прогонов делегатов (сюда — сбои/нюансы).
