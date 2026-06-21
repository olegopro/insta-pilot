# Agent Factory — фабрика параллельной генерации админок

Архитектурный документ для оркестрации, где пользователь диктует ГОЛОСОМ/человеческим языком десятки
админ-экранов (50–80 вложенных структур: аккордеоны, таблицы, внутренние дашборды), а фабрика строит
их параллельно, КОГЕРЕНТНО (по линтерам/стилю/FSD), стабильно и при ОГРАНИЧЕННОМ токен-бюджете Kiro.

Это надстройка над уже существующими `playbook.md` (плейбук параллелизма),
`.claude/skills/parallel-feature-build/SKILL.md` и `.claude/agents/dashboard-builder.md`. Здесь —
полная топология фабрики, гарантии когерентности, бюджет токенов, верификация, observability,
безопасность и поэтапный rollout.

Стек целевого проекта: Laravel 13 (PHP 8.3) + Vue 3/Quasar/TypeScript по FSD + Python FastAPI +
PostgreSQL + Redis + Laravel Reverb, всё в Docker. Агенты-исполнители — делегаты через MCP `kiro-cli`
(официальная обёртка над `kiro-cli chat`, трафик через SOCKS-прокси) на модели Kiro.

> **Источник доверия.** Документ — свод ДВУХ независимых глубоких анализов, сошедшихся на ядре:
> внутренний мульти-агентный веб-ресерч (19 агентов, состязательная проверка ключевых утверждений по
> источникам) и Codex (xhigh, с чтением реального репозитория). Названные инструменты проверены на
> существование и актуальные версии (`steiger`, `spectral`, `openapi-typescript`, `plop`, `lefthook`,
> `dedoc/scramble`).

---

## 0. Pre-flight: дрейф кода и документации — починить ДО фабрики

Codex при чтении репозитория нашёл расхождения; всё подтверждено проверкой. Фабрику нельзя строить на
неверной документации и нарушенной FSD-границе — она размножит ошибку на десятки экранов.

1. **Laravel = `v13.15.0`** (`backend-laravel/composer.lock`), а не «12». Поправить `CLAUDE.md`/`README`.
2. **Каналы broadcast в коде** — `account-activity.{accountId}` и `activity-global.{userId}`
   (`routes/channels.php`, `app/Events/ActivityLogCreated.php`), а в `CLAUDE.md` записан несуществующий
   `private:activity-log`. Поправить доку — это же эталон события для кокпита (§8).
3. **Нарушение FSD**: `shared/ui/media-card/MediaCard.vue` и `shared/ui/media-display/*` импортируют
   `@/entities/media-post` (`shared` тянет вышестоящий слой). Вынести в `entities/media-post/ui/`, иначе
   `steiger` (§3.4) краснеет на эталоне и воркеры скопируют нарушение.

Эти три фикса — нулевой шаг rollout (§10), до включения гейтов и запуска первой волны.

---

## 1. Резюме и принципы

### 1.1 Что строим

Двухуровневый **orchestrator → squads → workers** конвейер с фазами `plan → wave-0 (швы) →
fan-out (worktree-воркеры волнами) → verify → reduce (последовательный merge)`. Когерентность держится
НЕ на качестве модели, а на детерминированных «стенах» (scaffolding + contract-first + типы из схемы +
линтеры/FSD-boundaries как блокирующие гейты). Параллельность строго ограничена реальным числом живых
Kiro-аккаунтов. Наблюдаемость — на УЖЕ имеющемся Reverb/Echo/Redis (новый Vue-слайс
`features/agents-cockpit`).

### 1.2 Принципы (главное вперёд)

1. **Детерминизм > промптинг.** Свободная LLM-генерация недетерминирована даже при `temperature 0`
   (структура/корректность плывут между идентичными запросами — [ACM TOSEM
   10.1145/3697010](https://dl.acm.org/doi/full/10.1145/3697010), [Thinking
   Machines](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/)) и без жёстких
   гейтов дрейфует в неконсистентную архитектуру. Каждый класс ошибки агента превращаем в «не пройдёт
   гейт», а не в «надеемся, модель сделает правильно».

2. **Контракт ДО фан-аута, заморожен.** Общий шов (FSD-скелет, API-контракты, design-tokens,
   shared-типы) строится ОДИН раз в волне 0 и раздаётся воркерам read-only. Контракт через один
   проверяющий слой (оркестратор-валидатор) сдерживает амплификацию ошибок в ~4 раза против
   децентрализованной раздачи (4.4x vs 17.2x — [Google
   2512.08296](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/)).

3. **Изоляция сильнее коммуникации.** Воркеры НЕ общаются между собой (источник «телефонной игры» —
   [Cognition](https://cognition.com/blog/dont-build-multi-agents)). Они изолированы в git-worktree,
   координирует только оркестратор; швы согласуются раз в волне 0 как ФАЙЛЫ, а не как чат.

4. **Ширина, а не глубина контекста.** Выигрыш мульти-агента — от множества НЕЗАВИСИМЫХ задач, а не от
   раздувания контекста на агента (token usage объясняет ~80% разброса качества —
   [Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)). Каждому воркеру —
   минимальный contract-срез + just-in-time retrieval, а не дамп слайса.

5. **Параллельность = число живых аккаунтов, а не число задач.** При `A_concurrent > k` лишние агенты
   висят в spacing-очереди (M/D/1, ρ>1), wall-clock не падает, токены за висящий контекст тратятся.
   Окно параллельности = `k` (см. §5).

6. **Worktree изолирует файлы, не семантику и не runtime.** Семантические seam-конфликты (имена пропсов,
   пути API, формы DTO), shared-файлы (роутер, барели) и runtime (порты/БД/Reverb) worktree НЕ решает —
   их закрывают contract-файл, авто-дискавери/integrator-агент и per-worktree-изоляция стека (§3, §6).

### 1.3 Калибровка под нашу реальность

- **Это режим «десятки ОДНОТИПНЫХ структур с устойчивым контрактом»** — именно тут codegen + жёсткие
  гейты выигрывают у свободной генерации каждого экрана ([verdict
  partial](https://arxiv.org/html/2509.03310v2): для единичных простых UI scaffolding оверинжинирит,
  для массы однотипных — выигрывает; гейты должны быть СОДЕРЖАТЕЛЬНЫМИ, не boot-only).
- **При текущем эффективном `k=1`** (активен один Kiro-аккаунт, остальные `disabled`) 50–80
  структур с self-healing — это РАБОЧИЙ ДЕНЬ (2.5–6.7 ч), а не минуты. Скорость берётся поднятием `k`
  (re-enable аккаунтов), а не числом агентов.

---

## 2. Топология оркестрации

### 2.1 Схема

```
                          ┌─────────────────────────────────────────────┐
   ГОЛОС / человеческий →  │  ORCHESTRATOR (Claude Code lead-сессия)      │
   язык: «дай 60 админок» │  • ASR → текст                              │
                          │  • clarification-loop (неоднозначность)      │
                          │  • декомпозиция в DAG батчей (squads)        │
                          │  • генерация SPEC + CONTRACTS  (волна 0)      │
                          └───────────────┬─────────────────────────────┘
                                          │  HUMAN-APPROVAL GATE (план+контракт)
                                          ▼
              ┌─────────── WAVE 0 (единственный писатель швов) ───────────┐
              │ shared/ui-обёртки · design-tokens · OpenAPI · DTO-паттерн │
              │ FSD-скелет (Plop) · entities-базы · миграции БД           │
              └───────────────┬───────────────────────────────────────────┘
                              │  замороженный контракт раздаётся read-only
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
   ┌─────────┐          ┌─────────┐            ┌─────────┐
   │ SQUAD A │          │ SQUAD B │            │ SQUAD C │   ← тематические батчи
   │аналитика│          │настройки│            │модерация│     (sub-очереди)
   └────┬────┘          └────┬────┘            └────┬────┘
        │ очередь воркеров с окном = k живых Kiro-аккаунтов
        ▼                                            ▼
   ┌──────────────────── FAN-OUT (волнами по k) ──────────────────┐
   │ worker(worktree-1) worker(worktree-2) ... worker(worktree-k) │  ← dashboard-builder
   │ каждый: 1 структура (или батч однотипных) · self-check · NOTES│
   └───────────────┬──────────────────────────────────────────────┘
                   │ condensed summary (1–2k токенов) + ветка
                   ▼
   ┌─────────────────── VERIFY (детерминированные гейты) ──────────┐
   │ eslint · vue-tsc · FSD-boundaries · Pint · PHPStan · Playwright│
   │ secret-scan · SAST · self-healing loop (3–5 итер, бюджет)      │
   └───────────────┬──────────────────────────────────────────────┘
                   │ зелёные ветки
                   ▼
   ┌─────────── REDUCE (последовательный merge + integrator) ──────┐
   │ merge-queue по одной ветке · rebase-on-main · seam-регистрация │
   │ (routes.ts / AppNavTabs.vue) одним integrator-агентом          │
   └───────────────────────────────────────────────────────────────┘
                   │  события на каждом шаге (hooks)
                   ▼
            hooks → Laravel /internal/agent-events → Reverb → Vue features/agents-cockpit
```

### 2.2 Почему эта топология, а не альтернативы

| Альтернатива | Почему НЕ она |
|---|---|
| Один агент с огромным контекстом | 50–80 структур не влезают в окно; context rot (n² attention) роняет recall → агент «забывает» контракт. Для НЕзависимых задач рой выигрывает шириной. |
| Плоский fan-out на 50–80 агентов | Невозможно: лимит Kiro-аккаунтов + взрыв контекста супервизора. На 4+ воркерах контекст оркестратора часто превышает окно ([Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)). |
| Peer-to-peer / mesh / blackboard | N(N-1)/2 связей, «телефонная игра», конфликтующие неявные решения. Окупается на READ-исследовании, портит состояние на координированной ЗАПИСИ ([Cognition](https://cognition.com/blog/dont-build-multi-agents)). |
| **Иерархический supervisor (наш выбор)** | Идеален для low-coupling параллельных подзадач (=независимые админки). Централизация сдерживает амплификацию ошибок (4.4x vs 17.2x). Минус — супервизор bottleneck → лечится compact-отчётами вместо полных трейсов (§5). |

**Верный нюанс из вердиктов:** иерархия лучше по качеству/масштабу/стабильности, но НЕ «токен-эффективнее»
как общее правило — orchestrator-worker ТРАТИТ ~15x токенов чата, торгуя их на качество. Поэтому она
оправдана именно для высокоценной массы однотипных структур, а не для дешёвого потока. Кодинг — слабо
параллелизуемый домен: параллельную ЗАПИСЬ держим раздельной по worktree, а синтез/merge — централизованно.

### 2.3 Роли

- **Orchestrator** (Claude Code lead) — декомпозиция, генерация контракта, запуск волн, сбор сводок,
  merge. НЕ копит полные трейсы воркеров.
- **Squad** — тематический батч структур (sub-очередь). Это логическая группировка, не отдельный
  агент-координатор (peer-координация запрещена). Squad = единица DAG-зависимостей.
- **Worker** — `dashboard-builder` (`.claude/agents/dashboard-builder.md`), `isolation: worktree`,
  строит ОДНУ структуру (или батч однотипных), self-check, отдаёт condensed summary.
- **Integrator** — отдельный финальный агент/сам оркестратор: правит seam-файлы по сводкам.
- **Verifier/coherence** — отдельный проход, трассирует контракты/импорты/типы по стыкам.

---

## 3. Когерентность в масштабе = гарантии, а не надежда

Шесть детерминированных «стен». Каждая превращает класс ошибки из «вероятно» в «не пройдёт гейт».

### 3.1 Scaffolding / golden-path (Plop)

Воркер НЕ создаёт структуру файлов с нуля — это главный источник архитектурного разброса. Генератор
по декларативной спеке создаёт детерминированный скелет FSD-слайса.

Завести `frontend-vue/plopfile.mjs` + шаблоны `frontend-vue/plop-templates/fsd-slice/`:

```
pages/<name>/ui/<Name>Page.vue        ← обёртка в PageComponent
pages/<name>/index.ts                 ← export { default as <Name>Page }
widgets/<name>/ui/<Component>.vue
widgets/<name>/index.ts
entities/<name>/model/apiTypes.ts     ← snake_case, суффикс Api
entities/<name>/model/types.ts        ← camelCase
entities/<name>/model/<name>DTO.ts
entities/<name>/model/<name>TableColumns.ts  ← satisfies QTableColumn<RowModel>[]
entities/<name>/model/<name>Store.ts  ← Pinia + useApi
entities/<name>/index.ts              ← public API
```

Команда воркеру: `npx plop fsd-slice --name <name>` ДО написания логики. Скелет 100% единообразен без
участия модели; токены не тратятся на boilerplate — только на бизнес-логику в готовых слотах.

**Re-run-safety обязательна:** повторный прогон НЕ должен дублировать файлы. Условная генерация по
факту существования (есть файл → не пересоздавать). Дефолтное поведение генераторов НЕ идемпотентно
([Yeoman issue #725](https://github.com/yeoman/generator/issues/725)) — в Plop-actions проверять
предусловие перед мутацией.

### 3.2 Contract-first (OpenAPI как SSOT)

Фундамент когерентности фронт↔бэк — одна схема, а не код агента.

- **Laravel** → `dedoc/scramble` (`composer require dedoc/scramble`), авто-OpenAPI 3.1 из роутов,
  FormRequest, API Resources, отдаёт `/docs/api.json`. Для НОВЫХ админок — design-first: оркестратор
  фиксирует схему в волне 0, Scramble служит контрольной сверкой «бэк не разошёлся».
- **FastAPI** → схема из Pydantic by design (`/openapi.json`), всегда совпадает с реализацией.
- **Governance:** одна команда схемы под линтером [Spectral](https://github.com/stoplightio/spectral)
  (единый style-guide имён эндпоинтов/моделей) в CI ДО кодгена — иначе разнобой в схеме размножится во
  все типы.
- **Замыкание контракта тестами:** `hotmeteor/spectator` в Laravel-тестах
  (`->assertValidRequest()`/`->assertValidResponse()`) ловит дрейф реализации бэка от схемы. Без него
  типы фронта врут.

### 3.3 Типы end-to-end из схемы

Базовая ставка — `openapi-typescript` + `openapi-fetch` (только типы, 1 файл, минимум кода под ревью,
экономия токенов). `Orval` — точечно, только где реально нужны TanStack-хуки + Zod-рантайм. Кодген в
pre-commit и CI, чтобы типы не устаревали. Воркеру-фронтендеру дают сгенерированные типы ВМЕСТО контекста
бэкенда.

Наш DTO-паттерн остаётся как локальный слой: `apiTypes.ts` (snake, `Api`) → `types.ts` (camel) →
`*DTO.ts` (`toLocal()`), см. `CLAUDE.md` «Типы и DTO». Генерированные OpenAPI-типы кормят `apiTypes.ts`.

### 3.4 FSD-boundaries как блокирующий гейт

Сейчас в `frontend-vue/eslint.config.js` есть `eslint-plugin-no-relative-import-paths` и кастомное
`local/arrow-concise-body`, но НЕТ архитектурного линтера слоёв. Добавить:

- **`steiger`** (официальный FSD-линтер): `fsd/public-api`, `fsd/forbidden-imports`
  (запрет импорта вышестоящих слоёв и cross-slice), `fsd/no-segmentless-slices`. В pre-commit/CI.
  **Пиннить версию** — beta, ломал конфиг между релизами.
- **ESLint flat-config** `@feature-sliced/eslint-config` или `eslint-plugin-fsd-lint` — inline-фидбэк
  при редактировании.

PR воркера с нарушением слоя просто не проходит — независимо от модели.

### 3.5 Единый блокирующий пайплайн (lefthook)

Один YAML на Docker-монорепо (PHP+TS+Python, параллельно) — `lefthook.yml` в корне. Те же гейты в CI
(локальный хук обходим `--no-verify`).

```yaml
# lefthook.yml (корень insta-pilot)
pre-commit:
  parallel: true
  commands:
    eslint:    { root: frontend-vue/, glob: "*.{ts,vue}", run: "npx eslint --fix {staged_files}" }
    prettier:  { root: frontend-vue/, glob: "*.{ts,vue,scss}", run: "npx prettier --write {staged_files}" }
    vue-tsc:   { root: frontend-vue/, run: "npx vue-tsc --noEmit" }
    steiger:   { root: frontend-vue/, run: "npx steiger src --fail-on-warnings" }
    pint:      { root: backend-laravel/, glob: "*.php", run: "./vendor/bin/pint {staged_files}" }
    phpstan:   { root: backend-laravel/, run: "./vendor/bin/phpstan analyse --memory-limit=512M" }
```

В контейнере команды гоняются как в `dashboard-builder.md`: `docker compose exec vue npx eslint --fix`,
`docker compose exec vue npx vue-tsc --noEmit`.

### 3.6 Design-tokens + shared Quasar как контракт вида

Визуальная когерентность 60 структур — не «модель помнит стиль», а ОДИН набор разрешённых кирпичей:

- `frontend-vue/src/shared/ui/*` — единственные разрешённые компоненты (уже есть: `page-component`,
  `table-component`, `card-component`, `input-component` и др.). Воркер НИКОГДА не пишет сырой `q-table`
  — только `TableComponent` (правило из `dashboard-builder.md`).
- **design-tokens** через Style Dictionary: `tokens.json` → CSS-vars/TS-константы. Воркер не выбирает
  hex/px, а потребляет токены.
- **Stylelint-правило «raw hex/px запрещены, только `var(--token)`»** — иначе токены бесполезны
  (агент вставит raw-значение).

> Граница изоляции = граница слабой связанности (ЦЕЛАЯ админка одному воркеру). Внутри одной структуры
> взаимозависимое (схема + типы + слайс) НЕ резать между агентами — иначе Flappy-Bird-рассогласование.

---

## 4. Общая база (shared common base)

Правило: **общий шов строится ОДИН раз ДО фан-аута, единственным писателем (волна 0).**

### 4.1 Что входит в shared base

| Артефакт | Путь | Кто пишет |
|---|---|---|
| Design system / обёртки | `frontend-vue/src/shared/ui/*` | волна 0 (оркестратор) |
| Design-tokens | `frontend-vue/src/css/tokens.json` | волна 0 |
| OpenAPI-контракт | `backend-laravel` → `/docs/api.json`, `python-service` → `/openapi.json` | волна 0 |
| Сгенерированные TS-типы | `frontend-vue/src/shared/api/generated/` | кодген (CI) |
| DTO-конвенция | `apiTypes(snake)→types(camel)→*DTO` | контракт в `CONTRACTS.md` |
| Конверт ответа | `{ success, data, message }` (см. `CLAUDE.md` API Response Format) | контракт |
| FSD-скелет | `frontend-vue/plop-templates/` | волна 0 |
| Базовые entities/миграции | `entities/*`, `database/migrations/*` | волна 0 |

### 4.2 CONTRACTS.md — единый reference-файл

ДО любого фан-аута оркестратор генерирует `CONTRACTS.md` (mandatory read-only для каждого воркера). Это
единственная проверенная защита от seam-bugs (кейс «8 агентов написали идеальные компоненты — и ничего
не заработало»: разные имена колонок/путей API/форматов ID — [dev.to/aws](https://dev.to/aws/8-agents-wrote-perfect-components-and-nothing-worked-2176)).

Содержимое `CONTRACTS.md`:
- FSD-границы и владение (какой воркер какие папки создаёт; что read-only).
- Имена сущностей/слайсов/стора/роутов (фиксированные — против Referential Drift).
- Props-контракты переиспользуемых компонентов (`PageComponent`, `TableComponent`).
- API-контракты Laravel↔Vue↔FastAPI: пути, snake↔camel-маппинг, формы DTO, конверт.
- Конвенции имён/ID, design-tokens-палитра.

### 4.3 snake↔camel и DTO

Граница фронт↔бэк фиксирована конвенцией проекта:
- Бэкенд отдаёт snake_case → `apiTypes.ts` (суффикс `Api`).
- Фронт работает camelCase → `types.ts` + `*DTO.ts` (`toLocal()`).
- Конверт: `{ success: bool, data, message }` (успех) / `{ success: false, error }` (ошибка).

DTO-слой — детерминированный шов: меняется схема → регенерируются `apiTypes.ts`, DTO-маппинг ловит дрейф
типов на компиляции (`vue-tsc`).

### 4.4 Миграция shared-контракта между волнами

Когда волна 0 написала швы, а ПОЗЖЕ нужно сменить shared-контракт — **только expand-contract /
parallel-change** ([M.Fowler](https://martinfowler.com/bliki/ParallelChange.html)), никогда не big-bang:

1. **Expand** — добавить новую версию шва, не трогая старую (сосуществуют).
2. **Migrate** — переключать уже-смерженные структуры (codemod: `ast-grep`/`jscodeshift` на TS, `Rector`
   на PHP).
3. **Contract** — удалить старую версию, когда ни один потребитель её не использует.

Переинвалидация затронутых структур — автоматически через consumer-driven contract testing (Pact-стиль)
+ provider-verification в CI: падение контракт-тестов = детерминированный список «кого перестроить».

---

## 5. Токен/контекст-бюджет под Kiro

### 5.1 Реальная пропускная способность (количественно)

Kiro держит per-account (per-auth) spacing — на одном аккаунте вызовы сериализуются паузами порядка
единиц–десятка секунд (оценочная пауза per-account ~8.5с), плюс retry-buffer на ретраях.

- **Голый потолок по spacing:** `1/8.5 ≈ 0.118` старта/с ≈ **~7 стартов/мин на аккаунт**.
- **Но боттлнек — не spacing, а длительность вызова.** Кодинг-вызов (build структуры + self-healing)
  длится 45–120с — в 4–14x дольше spacing. Поэтому реальный throughput ≈ `k / call_duration ≈ k`
  вызовов/мин. Spacing «прячется» внутри вызова на тяжёлой нагрузке, но БЬЁТ на лёгких частых
  (CountTokens, мелкие фиксы — там RPM-потолок 7/мин/аккаунт реален; `track-count-tokens: false` уже
  смягчает).
- **Точка убыточности параллелизма: `A_concurrent > k`.** Аккаунт при scope=`auth` — M/D/1-сервер.
  Пул из `A` агентов даёт utilization `ρ = A/k`. При `A>k` (ρ>1) очередь растёт линейно, wall-clock не
  падает, токены за висящий контекст тратятся ([Little's
  law](https://en.wikipedia.org/wiki/Little's_law)). **Окно параллельности = `k`.**

### 5.2 Формула обещания скорости (вписать в `playbook.md`)

```
wall_clock_волны ≈ (N_структур × вызовов_на_структуру / k_активных) × call_duration_сек

вызовов_на_структуру = 1 (build) + self-healing(3–5) + gate-re-runs(~0.5–1) ≈ 3 (оптимист) … 5–6 (пессимист)
call_duration ≈ 60с (с retry-buffer)
```

| k | W=150 (50×3, оптимист) | W=400 (80×5, пессимист) |
|---|---|---|
| **1** (сейчас) | 2.5 ч | 6.7 ч |
| 2 | 1.25 ч | 3.3 ч |
| 4 | 38 мин | 1.7 ч |

**Единственный рычаг near-linear speedup — поднять `k`** (поднять дополнительные Kiro-аккаунты —
отдельные профили `kiro-cli login`). Агенты сверх `k` бесполезны. Озвучивать пользователю реалистичную вилку, не «быстро».

### 5.3 Token-бюджет волны

Грубо: `T ≈ W × (4k base + накопленный контекст)`. С self-healing накопление контекста реалистично
8–20k input/вызов. Средний ~12k input + ~1.5k output. Для W=400: ~4.8M input на ОДНУ волну (без
failure-амплификации; с красными гейтами ×1.7–2.5 → до 8–12M).

**Планировать ВОЛНАМИ по token-budget:** оценить `лимит_токенов_аккаунта × k`, поделить на ~12–15k
эффективных ток/структуру → max структур/волну до упора в лимит. Остальное — следующими волнами (иначе
каскад 429 → retry-buffer раздувает wall-clock непредсказуемо).

### 5.4 Бюджетные правила (практическая таблица)

| Рычаг | Правило | Эффект |
|---|---|---|
| **Изоляция контекста** | Воркер читает 15 файлов в своём окне, отдаёт оркестратору condensed summary 1–2k токенов (что построено / контракты / хвосты / нарушения), НЕ полный трейс | Оркестратор не взрывается; -15x риск |
| **Retrieval, не дамп** | НЕ векторный RAG. `ripgrep`/`glob` + точечный `Read` + lightweight-идентификаторы (пути из контракта). Не грузить целый слайс | grep свежее RAG (нет дрейфа индекса в worktree), -prompt-токены |
| **Выбор модели по задаче** | Из 3 рабочих Kiro-моделей: мелочь (git, переименования, тривиальные правки) → дешёвая `glm-5`. Код/логика → `claude-sonnet-4.6` (+ `-agentic` для записи файлов). Макс. качество → `claude-opus-4.8`. `dashboard-builder` уже `model: sonnet` | -стоимость без потери качества кода |
| **Компакция** | У предела окна — суммаризовать (сохранять архитектурные решения/контракты, выкидывать сырые tool-outputs — «tool result clearing»), продолжать с compressed + 5 последних файлов | защита от context rot на длинных структурах |
| **Кэш (проверить!)** | Статика В НАЧАЛЕ префикса (system + фикс-набор тулов + CONTRACTS + FSD-конвенции), волатильное (session_id/timestamp/задача) В КОНЕЦ. Стабильный набор тулов. **Prompt caching на пути `kiro-cli`/официального Kiro CLI — это поведение бэкенда Kiro; не закладывать cache-экономию как данность, проверить эмпирически** | если кэш есть — до 90% дешевле; если нет — экономия только сокращением контекста |
| **Окно self-healing** | `W=2–3`: при re-run по красному гейту давать агенту ТОЛЬКО diff+ошибку, не всю историю. Срезает квадратичный член `N(N+1)/2` | главный пожиратель токенов в self-healing |
| **Hard token-budget** | Cap N итераций/структуру + circuit-breaker по `retry_tokens/total > 10%` (Google-SRE: без бюджета ×3, с бюджетом ×1.1) | защита узкого лимита от каскада |
| **Батчинг однотипного** | Десяток одинаковых CRUD-аккордеонов → ОДИН воркер строит группу 3–5 за контекст (амортизирует 4k base + общий скелет), а не агент на каждый | -токены, -поверхность дрейфа |
| **Шаблонизатор вместо N агентов** | Для почти-идентичных админок — детерминированный Plop/генератор по JSON-спеке; LLM только на уникальную дельту | идемпотентно и когерентно by construction |

### 5.5 Кэш, привязка сессий и конкуренция (под `kiro-cli`)

**Prompt caching — важная оговорка.** Prompt caching на пути `kiro-cli`/официального Kiro CLI — это
поведение бэкенда Kiro, а не оркестратора: гарантий кэширования стабильного префикса (`CONTRACTS.md`)
нет. Не закладывать cache-экономию как данность для Kiro — проверить эмпирически; при остром
токен-бюджете рассмотреть нативные Claude-аккаунты под оркестратор/reviewer (там кэш есть).

**Привязка к сессии.** `kiro-cli` хранит сессию на диске (per-директория); продолжение через
`reply(session_id)` держит ту же сессию — это и есть стабильная привязка (и cache-locality, если бэкенд
Kiro кэширует). Никакой отдельной конфигурации для этого не нужно — достаточно переиспользовать
`session_id` воркера через `reply`.

**Конкуренция между аккаунтами.** Несколько одновременных Kiro-аккаунтов = несколько профилей
`kiro-cli login`; раскидывать задачи по профилям — на стороне оркестратора. Отдельного
маршрутизатора с round-robin (как в мёртвом прокси) больше нет. Per-account (per-auth) spacing держит сам
бэкенд Kiro — на одном аккаунте вызовы сериализуются (оценочная пауза ~8.5с, §5.1); рычаг near-linear
ускорения — поднять число живых аккаунтов `k` (§5.2).

---

## 6. Координация и git

### 6.1 Worktree-изоляция — что решает и что НЕТ

Worktree — рабочий, проверенный механизм (поддержан VS Code с июля 2025, Claude Code), интеграция через
merge, а не через общение агентов ([verdict
partial](https://www.augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution)). Но он:

- **Решает:** одновременную запись в файлы, порчу git-индекса, lock contention.
- **НЕ решает (важно!):** конфликты СМЕЩАЮТСЯ на merge-time и остаются частыми (в датасете AgenticFlict
  2026 — 27.67% PR от AI-агентов с merge-конфликтами); семантические seam-конфликты (clean merge,
  ломающийся runtime); shared-файлы (роутер, барели, i18n); **runtime** — порты/БД/Reverb/секреты.

### 6.2 Сериализация швов

Shared-файлы (`src/router/routes.ts`, `src/layouts/AppNavTabs.vue`, бэк `routes/api.php`,
`AppServiceProvider.php`) воркерам редактировать ЗАПРЕЩЕНО (`dashboard-builder.md` уже это фиксирует).
Два механизма:

1. **Авто-дискавери по конвенции** (предпочтительно где возможно): роуты/слайсы подхватываются по
   структуре файлов — тогда правка реестра не нужна вовсе.
2. **Integrator-агент** (фолбэк): один финальный агент/оркестратор последовательно дописывает реестры
   по сводкам воркеров (как в `playbook.md` шаг 3).

### 6.3 Интеграция на merge (merge-queue)

- **Последовательно**, по одной ветке: `rebase-on-main` после каждого merge; гейты прогонять против
  БУДУЩЕГО состояния main (`git merge-tree` pre-check), а не устаревшей базы ветки — иначе логические
  seam-конфликты проскочат.
- **merge-queue с bisect-on-failure:** провальная ветка ejected автоматически, остальные проходят. Это
  «откат только её ветки» — не нужно откатывать всю интеграционную волну, 79 здоровых мёржатся (§9.3).

### 6.4 Межагентная НЕ-коммуникация

Воркеры не общаются. Координирует только оркестратор. Швы согласованы раз в волне 0 как файлы. Это и есть
лечение «телефонной игры» и квадратичного роста связей.

### 6.5 Runtime-изоляция per-worktree (если нужен прогон стека)

`COMPOSE_PROJECT_NAME` НЕ изолирует — worktree делят Docker-сеть, volume, порты. Для прогона стека на
ветку нужна полная изоляция: уникальный `COMPOSE_PROJECT_NAME` + сеть + диапазон портов
(`base + index`) + отдельные `DB_NAME`/volume. Наши фиксированные порты (`vue:9000`, `nginx:8000`,
`python:8001`, `reverb:8080`, `postgres:5432`, `redis:6379`) при k>1 worktree коллизируют → префиксовать.
Держать ПУЛ стеков по числу параллельных агентов, гасить после верификации (стек тяжёлый).

> Для большинства FSD-дашбордов прогон полного стека на воркера не нужен — правки чисто в `src`,
> typecheck/lint гоняются в общем контейнере, Playwright — на финальной интеграции (см. `playbook.md`
> §4.1: worktree не изолирует `node_modules`, тяжёлый install параллельно не нужен).

### 6.6 Re-run-safety воркера (идемпотентность)

Упавшую попытку НЕ дочинивать в грязном дереве (источник append-дублей). Fresh-attempt / crash-only:
`git worktree remove` + создать заново, ИЛИ `git reset --hard && git clean -fdx`. Единственный атомарный
чекпойнт = коммит в ветку. Защита от гонок за `.git/`: retry с backoff на `index.lock`/`config.lock`
(200мс→3.2с), jitter 100–500мс при создании worktree, **никогда не авто-удалять worktree с грязным
`git status --porcelain`** — сохранять и репортить (на 10+ агентах ~62% теряют работу без этой защиты).

---

## 7. Верификация

Каскад гейтов дешёвое→дорогое, fail-fast. Гейты 0–2 детерминированы и НЕ жгут Kiro-токены — агент
дёргается повторно лишь на красном.

```
Этап 0 (секунды, без браузера/LLM):  vue-tsc --noEmit · eslint(+FSD steiger) · prettier --check
                                      Pint · PHPStan · ruff/mypy (FastAPI)
Этап 1 (десятки секунд):             Vitest unit + @vue/test-utils (селекторы data-test, не CSS-классы)
Этап 2 (минуты):                     Playwright E2E по админкам (изолированные контексты)
Этап 3 (nightly/на merge):           visual regression (toHaveScreenshot, @visual-тег, --grep-invert)
Этап SEC (на каждой ветке до merge): secret-scan (gitleaks) · SAST (semgrep) · Laravel-чеклист (§9.2)
```

### 7.1 Playwright (изолированные контексты)

- Параллелизм браузеров — на уровне ОРКЕСТРАТОРА (каждая worktree → свой прогон), а не Playwright.
- Внутри прогона: `fullyParallel: true`, воркеров `≤ floor(vCPU)` (4 воркера на 2 vCPU = таймауты),
  `browser.newContext()` для ролей/сессий внутри одной админки.
- В Docker: официальный образ `mcr.microsoft.com/playwright` (фикс-тег) + `--disable-dev-shm-usage`
  (64MB /dev/shm роняет Chrome). baseline visual-тестов генерить в той же Linux-среде, что и прогоны.
- Наш `playwright.config.ts`: `baseURL: http://127.0.0.1:9000`, `headless: true`,
  `screenshot: only-on-failure`. Селекторы — `data-test`, не Quasar-классы (меняются между версиями).

### 7.2 Превью-на-ветку

Опционально для тяжёлых прогонов: per-worktree ephemeral-стек (§6.5) + Traefik как Docker-провайдер
(авто-роут `branch.localhost` по labels). Держать пул по числу агентов, гасить по завершении.

### 7.3 Self-healing loop (с жёсткими границами)

Подавать агенту ТОЛЬКО diff/хвост лога ошибки (не весь вывод — раздувает ~4k base). Бюджет **3–5
итераций**, явный completion-promise, после исчерпания — эскалация оркестратору, НЕ бесконечный прогон
(при per-account spacing Kiro: паузы × итерации = простой + сжигание квоты; границы Dagger-цикла надо вводить
принудительно). Валидация — повторным запуском РЕАЛЬНЫХ команд проекта (`eslint`/`vue-tsc`/тесты), не
переизобретая их. Опционально GAN-паттерн: дешёвый Generator (Kiro) + скептичный Evaluator на критичных
админках.

### 7.4 Coherence-агент после интеграции

Отдельный проход трассирует реальные потоки через границы слайсов (props-контракты, импорты, роуты,
типы vs `CONTRACTS.md`) — паттерн, который в кейсе 8 агентов «fixed all 17 bugs in one pass».

---

## 8. Наблюдаемость: agents-cockpit на Reverb/Echo/Redis

### 8.1 Принцип

Claude Code hooks — **нулевая токен-стоимость** и out-of-band исполнение
([docs](https://code.claude.com/docs/en/hooks)). Observability вешается СБОКУ, не раздувая контекст
агентов. Переиспользуем УЖЕ имеющийся Reverb/Echo/Redis — НЕ тащим Bun/SQLite/отдельный WS из
OSS-дашбордов (это лишний стек и точка отказа). Из
[disler/claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability)
берём только UI-концепции (swim-lane по сессии, pulse-chart, tool→эмодзи, Kanban-статусы), транспорт —
наш.

### 8.2 Поток

```
.claude/settings.json hooks (SubagentStart/Stop, PreToolUse/PostToolUse,
   PostToolUseFailure, Stop, SessionStart/End)
        │  POST (нативный type:'http' либо тонкий send_event.sh)
        ▼
POST /internal/agent-events  (Laravel-роут, валидация + throttle)
        │  → Redis-очередь broadcast (всплеск 50–80 агентов не блокирует)
        ▼
broadcast(new AgentEvent($payload))  на PrivateChannel('orchestration.{userId}')
        ▼
Laravel Reverb (:8080)  →  laravel-echo + pusher-js  (shared/lib/echo.ts)
        ▼
Vue features/agents-cockpit  ← живые тайлы worktree-агентов
```

### 8.3 Реализация в нашем стеке

- **Событие** по образцу `app/Events/ActivityLogCreated.php` (`ShouldBroadcastNow`, `PrivateChannel`,
  `broadcastWith`, `broadcastAs`): новый `app/Events/AgentEvent.php`, канал `orchestration.{userId}`
  (private, с авторизацией в `routes/channels.php` — НЕ public, события содержат cwd/команды/диффы).
- **Vue-слайс** `frontend-vue/src/features/agents-cockpit/` (FSD): подписка через `echo` из
  `shared/lib/echo.ts`, тайлы строит из `PageComponent` + `TableComponent`/`CardComponent`. Kanban-статусы
  (queued/running/blocked/done/needs-review), swim-lane по `session_id`, pulse-chart.
- **Control-plane, не read-only монитор:** кнопки на волну (pause-all / approve-plan / edit-contract /
  kill) и на воркер (pause / inject-instruction / restart / abort). Session-логи как поверхность steer —
  ловить дрейф (файлы вне scope, scope-creep, зацикливание) на ранней минуте.

### 8.4 Схема payload события

```json
{
  "source_app": "insta-pilot",
  "session_id": "<стабильный из ORCHESTRATION-конвенции>",
  "hook_event_type": "PostToolUse",
  "timestamp": "<ISO8601>",
  "worktree": "<cwd → ветка → тайл>",
  "tool_name": "Edit",
  "agent_id": "...", "agent_type": "dashboard-builder",
  "status": "running|blocked|done|failed",
  "payload": { "raw": "..." }
}
```

### 8.5 Грабли observability

- **Батчинг обязателен:** 50–80 агентов × PreToolUse/PostToolUse = тысячи событий/мин → коалесцировать
  прогресс в Redis, broadcast'ить дельтами/пачками (иначе Reverb/Vue захлёбываются — «что сломалось
  после 10M событий»).
- **Backpressure-safe хуки:** `async: true` + короткий timeout — недоступный дашборд НЕ должен блокировать
  кодинг-агентов.
- **Скриншоты — вне агента:** отдельный Node/Playwright headless-воркер по `SubagentStop` снимает
  screenshot dev-сервера worktree, кладёт в storage, Laravel broadcast'ит URL. Агентский Playwright —
  только self-validation (рендер картинок руками агента = слив токенов, inline-рендера в чат нет).
- **Прямой Pusher-HTTP-API Reverb из shell-хука** требует ручного HMAC — хрупко. Идти через Laravel-роут
  с `broadcast()`.
- **Стабильный `session_id`** переиспользовать через `reply` (сессия `kiro-cli` на диске) — иначе события расползутся по
  тайлам.

### 8.6 Второй контур (опционально)

`CLAUDE_CODE_ENABLE_TELEMETRY=1` + OTLP-экспорт `claude_code.token.usage` в SigNoz/Grafana — отдельно от
живого дашборда, чтобы видеть фактический расход и не упереться в лимиты Kiro. Self-hosted Langfuse — для
пост-фактум разбора «почему агент залип/сжёг контекст». НЕ пытаться сделать на них real-time fleet-view.

---

## 9. Человек-в-петле, безопасность, откат

### 9.1 Точки апрува

**Один обязательный синхронный (но async-реализованный) human-approval gate** ровно на ДВА артефакта
ПЕРЕД любым worktree/кодинг-агентом:

1. **decomposition** — список 50–80 админок с границами scope каждой.
2. **CONTRACTS.md** — общие FSD-интерфейсы, имена сущностей/слайсов/стора/роутов, API-контракты.

Это единственный Tier4-апрув (ошибка в контракте размножается необратимо на 80 агентов). Всё остальное
(обратимые worktree-правки) — автономно с логом; промежуточные результаты апрувить БАТЧЕМ, не поштучно
(иначе approval fatigue / rubber-stamping → вектор инъекций).

**Plan-then-Execute:** разрыв план↔исполнение — каноническое место гейта. План при ошибке
перегенерируется (replan: исходная цель + проваленный план + ошибка) БЕЗ запуска кодинг-агентов.

**Clarification-loop — обязательная фаза ДО декомпозиции** (вход голосовой, высокая неоднозначность):
SOTA-модели в 63% случаев кодят неоднозначную спеку БЕЗ уточнения. Детект — code-consistency-check
(2–3 интерпретации админки; расхождение = спросить), НЕ verbalized confidence (заявленные 90% ≈ 75%
реальных). Вопросы — таргетированно и батчем по всем неоднозначным админкам сразу.

**Durable-движок:** апрув async, состояние волны в durable-store, НЕ привязано к живому вызову делегата
(иначе протухнут Kiro-OAuth-токены, а таймауты убьют hold). На resume валидировать hash плана — если
изменился, инвалидировать апрув. Побочки (worktree/git/БД) — в узлы ПОСЛЕ approve или idempotent (upsert),
иначе при resume продублируются на 80 агентов.

### 9.2 Безопасность и секреты

Гейты стиля/типов/FSD security НЕ ловят — нужен отдельный SAST-гейт перед merge.

- **Секреты из зоны видимости агента:** вынести `.env` из рабочего дерева worktree, рантайм-секреты
  инжектить только в контейнер сервиса; deny-rules `Read(./.env*)` в `.claude/settings.json`/`.claudeignore`
  (defense-in-depth, не барьер). Иначе APP_KEY/DB-креды/Reverb-ключи утекут в Kiro И в observability-шину.
- **Разорвать lethal trifecta** (приватные данные + untrusted-вход + внешний канал): гонять воркер в Docker
  с network-egress allowlist (packagist/npm/github + Kiro-эндпоинт через SOCKS-прокси `kiro-cli` + git-remote, остальное deny) и
  БЕЗ доступа к продовой PostgreSQL/боевым секретам. Worktree изолирует файлы, НЕ процесс/сеть.
- **Голос И подтянутый код — untrusted:** не вклеивать сырой untrusted-текст в system-инструкции;
  доверять output-верификации (security-гейт на коде), не тексту задачи.
- **SAST-гейт на каждой ветке:** `gitleaks` (secret-scan) + `semgrep ci` (SQLi/XSS/IDOR/broken-authz) +
  **Laravel-чеклист как дешёвые детерминированные правила:**
  - модель без `$fillable`/`$guarded` → fail (mass-assignment: `is_admin`/`role`);
  - любой raw-SQL (`DB::raw`/`whereRaw`/конкатенация) → ручной флаг;
  - ресурс/экшен без Policy/Gate/middleware → fail (IDOR); FormRequest с `authorize()` обязателен;
  - `{!! !!}` в админ-выводе без обоснования → fail (XSS).
- **Секрет-гигиена перед делегированием:** вычищать паттерны APP_KEY/DB-кредов/токенов из промпта и
  `workdir` ДО отправки делегату (`kiro-cli` шлёт task + проектный CLAUDE.md в облако Kiro) и до записи
  в observability — секреты не должны утекать ни в Kiro, ни в observability-шину.
- **Slopsquatting:** lockfile обязателен, в гейте проверять существование/возраст/популярность новой
  зависимости, allowlist реестров (~20% рекомендованных пакетов не существуют, 43% галлюцинаций
  воспроизводимы).
- **Blast-radius:** branch protection на main (агент не пушит напрямую), merge запрещён при красном
  security-гейте, для админок над чувствительными данными — human-approval на merge. Агент предлагает PR
  и сам чинит CI, но НЕ self-authorizing на merge.

### 9.3 Откат

- **Одна из 80 провалила гейты** → merge-queue ejection (§6.3): откатывается только её ветка, 79 проходят.
  НЕ откатывать всю интеграционную волну.
- **Контракт-дрейф между волнами** → expand-contract (§4.4), никогда не big-bang.
- **Упавший воркер** → fresh-attempt в свежем worktree (§6.6), не дочинивать грязное дерево.

---

## 10. Поэтапный rollout

| Фаза | Что построить | Критерий готовности |
|---|---|---|
| **MVP-0 (уже есть)** | `dashboard-builder` + `parallel-feature-build` + `playbook.md` + делегаты `kiro-cli` (+ Codex) | 5 дашбордов параллельно из worked-example работают |
| **Фаза 1 — гейты** | `lefthook.yml` (§3.5), `steiger` в pre-commit/CI, SAST-гейт (gitleaks/semgrep + Laravel-чеклист) | красный гейт блокирует merge; локальные = CI |
| **Фаза 2 — контракт** | `dedoc/scramble` + Spectral + `openapi-typescript` кодген в CI; `CONTRACTS.md`-генератор; `hotmeteor/spectator`-тесты | типы из схемы, дрейф бэка ловится |
| **Фаза 3 — scaffolding** | `frontend-vue/plopfile.mjs` + FSD-шаблоны (идемпотентные); design-tokens (Style Dictionary) + Stylelint-стена | воркер наполняет скелет, не создаёт структуру |
| **Фаза 4 — observability** | `app/Events/AgentEvent.php` + `/internal/agent-events` + `features/agents-cockpit` (control-plane) | живые тайлы + кнопки pause/approve/kill |
| **Фаза 5 — human-in-loop** | durable-движок (LangGraph interrupt_before / Temporal); clarification-loop; approval-gate на decomposition+CONTRACTS | план апрувится async, replan без рестарта |
| **Фаза 6 — масштаб** | merge-queue + bisect; coherence-агент; per-worktree runtime-изоляция (если нужен прогон стека); re-enable Kiro-аккаунтов (поднять k) | 50–80 структур волнами, k≥2 |

Порядок не случаен: **сначала стены (гейты/контракт/scaffolding), потом масштаб.** Без детерминированных
гейтов фан-аут на 80 агентов = гарантированный рассинхрон.

---

## 11. Реалистичные ограничения и метрики

### 11.1 Throughput / стоимость

- Реальная одновременность = `k` живых аккаунтов (сейчас `k=1`). 50–80 структур при `k=1` = 2.5–6.7 ч
  (§5.2). Скорость линейно от `k`, не от числа агентов.
- Мульти-агент ~15x токенов чата. Оправдан для высокоценной массы однотипных структур, НЕ для дешёвого
  потока. Failure-амплификация (красный гейт + self-healing) ×1.7–2.5.

### 11.2 Где деградирует качество

- **Убывающая отдача за ~5 агентами** на большинстве задач (Google: старт с 2–3). +81% на параллелизуемых
  / −39…−70% на зависимых. Ширина выигрывает ТОЛЬКО на реально независимых структурах.
- **Дрейф длинной сессии:** ASI падает медианно после ~73 взаимодействий (task success 87%→51%). Дробить
  крупную структуру на короткие задачи с ре-якорением к спеке.
- **Фрагментированный контекст хуже отсутствия:** агент с частичным знанием уверенно генерит код,
  противоречащий невиденной части контракта → seam-bug, не ловится самим агентом. Лечение —
  shared-context-слой (CONTRACTS) + clear ownership + coherence-проход.
- **Детерминированные гейты реактивны:** ловят постфактум, не предотвращают. При росте N без
  shared-context число seam-bugs растёт быстрее, чем гейты их ловят.

### 11.3 Метрики для дашборда

`tokens/вызов`, `cache-hit` (если кэш есть), `rate-limit-отказы (429)`, `wall-clock/волну`,
`retry_tokens/total` (circuit-breaker >10%), `gate pass/fail по worktree`, `число висящих/дублирующих
агентов` (грабля «50 субагентов на простой запрос»), `seam-bugs пойманные coherence-агентом`.

---

## 12. Таблица ключевых решений и открытые вопросы

### 12.1 Ключевые решения

| Решение | Обоснование |
|---|---|
| Иерархия orchestrator→squads→workers, БЕЗ peer-to-peer | Low-coupling fan-out; централизация сдерживает амплификацию ошибок 4.4x vs 17.2x; peer = «телефонная игра» |
| Контракт ДО фан-аута, заморожен, read-only | Единственная защита от seam-bugs (кейс 8 агентов); один валидатор гасит дрейф |
| Окно параллельности = `k` живых аккаунтов | M/D/1: при A>k агенты висят в spacing-очереди, скорость не растёт, токены тратятся |
| Детерминизм > промптинг (scaffolding + типы + линтеры как гейты) | Свободная генерация недетерминирована даже при temp=0; дрейф архитектуры без гейтов |
| Переиспользовать Reverb/Echo/Redis для observability | Не дублировать инфру; hooks = 0 токенов; control-plane, не read-only |
| Worktree + последовательный merge + integrator для швов | Worktree решает файлы, не семантику/runtime; merge-queue ejection для отката одной ветки |
| Один human-gate на план+контракт, остальное автономно | Tier4-ошибка необратима ×80; поштучный апрув = approval fatigue |
| Security-гейт отдельно от стиля (SAST + Laravel-чеклист) | Линтер ловит форму, не SQLi/mass-assignment/IDOR |
| Волны по token-budget, не одна гигантская | Упор в лимит в середине → каскад 429 → непредсказуемый wall-clock |
| Батчить однотипные CRUD в один воркер / Plop-генератор | -токены (амортизация 4k base), идемпотентно, -поверхность дрейфа |

### 12.2 Открытые вопросы

1. **Prompt caching на пути Kiro — частично закрыто исходниками (см. §5.5).** В трансляторе Kiro
   обработки `cache_control` НЕТ (есть только в нативном Claude-executor + xAI `prompt_cache_key`). То
   есть на Kiro кэш префикса `CONTRACTS.md` скорее не работает — экономику строить на сокращении
   контекста, а не на cache-hit. Эмпирический замер (два идентичных вызова, latency/usage) остаётся
   полезным для подтверждения; зафиксировать в `../debug-protocol.md`. Альтернатива при остром бюджете —
   нативные Claude-аккаунты под оркестратор/reviewer (там кэш есть).
2. **Сколько Kiro-аккаунтов реально поднять (`k`)?** Сейчас активен один. Re-enable — единственный рычаг
   near-linear speedup; калибровать ToS-риск ротации.
3. **Durable-движок: LangGraph (тонкий Python-скрипт) или Temporal, или остаться в Claude Code lead?**
   Claude Code уже умеет worktree-изоляцию + dynamic workflows; durable нужен для async-апрува и
   чекпойнтов волны. Решить по сложности волн.
4. **Авто-дискавери роутов vs integrator-агент** для seam-файлов — какой механизм для нашего
   `router/routes.ts` (lazy child-route под `MainLayout`) дешевле и надёжнее.
5. **Per-worktree runtime-изоляция** нужна ли вообще для дашбордов (правки в `src`, прогон на интеграции)
   или только для редких структур, требующих живого бэка/Reverb.
6. **Реальная `call_duration`** под Kiro — измерить на 5–10 структурах, уточнить формулу §5.2 фактом.

---

## Связанные документы

- `playbook.md` — детальный плейбук параллелизма (контекст, git, worked-example, делегаты `kiro-cli` (+ Codex))
- `.claude/skills/parallel-feature-build/SKILL.md` — скилл фан-аута
- `.claude/agents/dashboard-builder.md` — субагент-исполнитель
- `CLAUDE.md` — конвенции проекта (FSD, DTO, API-формат, Reverb, обёртки Quasar)
- `~/www/kiro-cli-mcp/CLAUDE.md` — механика и границы делегирования Kiro (delegate/reply, модели, прокси, resume)
