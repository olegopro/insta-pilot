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
| 0 | [verify](phases/phase-0-verify.md) | 🟡 скрипт готов | `ced8489` (скрипт) | прогон на живом аккаунте (нужен тестовый аккаунт + согласие на reversible); зафиксировать формат ответов / `is_pinned` |
| 1 | [grid](phases/phase-1-grid.md) | ⬜ | — | стартует ПОСЛЕ гейта Phase 0 |
| 2 | [overlay](phases/phase-2-overlay.md) | ⬜ | — | |
| 3 | [mutations](phases/phase-3-mutations.md) | ⬜ | — | |
| 4 | [ads/autopost](phases/phase-4-ads-autopost.md) | ⬜ | — | 4B автопостинг — опц. |
| 5 | [analytics](phases/phase-5-analytics.md) | ⬜ | — | 5B insights = бизнес (future) |

**Сейчас ждём:** владелец указывает тестовый IG-аккаунт (id/логин) → прогон Phase 0 `--read-only` →
фиксация `is_pinned` и пути сериализации в [`feasibility.md`](feasibility.md) / [`api-contracts.md`](api-contracts.md)
→ согласование поста (`media_pk`) для reversible-мутаций → гейт → Phase 1.

**Лог решений (свежие — сверху):**
- **2026-06-25** — коммиты: `ce33d60` `docs(showcase)` (паутина + трекер), `ced8489` `chore(showcase)` (Phase 0 verify-скрипт); стейджились строго showcase-пути, параллельная automation-работа не затронута.
- **2026-06-25** — процесс: ветка одна (`main`), коммиты группами scope `showcase`; состояние плана ведётся в этом разделе (для продолжения в новых чатах).
- **2026-06-25** — развилки: архитектура = «доска-планировщик + реальные мутации»; объём = «фундамент по шагам»; меню «Витрина», slug `showcase`. Codex недоступен (402 `deactivated_workspace`).

## Карта документов

| Файл | Что внутри |
|---|---|
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
