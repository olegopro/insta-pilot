# insta-pilot — Project Memory

> **Карта документации (паутина `CLAUDE.md`).** Этот корневой файл — диспетчер: универсальный контекст +
> указатели, грузится в каждую сессию. Area-специфика вынесена во вложенные `CLAUDE.md` и подхватывается
> КОНТЕКСТНО (только при работе с файлами в соответствующей папке — это и есть разгрузка корня).
> `AGENTS.md` — symlink на этот файл (единый источник правды).

## Project Overview
Instagram auto-liker web service.
Stack: Laravel 13 (backend) + Python FastAPI + instagrapi (Instagram layer) + Vue 3 + Quasar (frontend).
DB: PostgreSQL 16. Queue: Redis.

## Project Structure
```
insta-pilot/
├── backend-laravel/    # Laravel 13, PHP 8.3                      → backend-laravel/CLAUDE.md
├── frontend-vue/       # Vue 3 + Quasar + TypeScript              → frontend-vue/CLAUDE.md
├── python-service/     # FastAPI + instagrapi                     → python-service/CLAUDE.md
├── docker/             # Dockerfiles (laravel/python/vue/nginx)   → docker/CLAUDE.md
└── docker-compose.yml
```

## Карта документации
Вложенные `CLAUDE.md` (грузятся контекстно при работе в папке — основная разгрузка корня):

| Область | Файл | Что внутри |
|---|---|---|
| Backend | `backend-laravel/CLAUDE.md` | PHP/Laravel код-стайл, `app/`, API-формат, 4 таблицы, Reverb-каналы, BE-тесты |
| Frontend | `frontend-vue/CLAUDE.md` | Vue/Quasar/FSD код-стайл, обёртки `shared/ui`, DTO, store/table-паттерны, FE-тесты, overlay |
| Python | `python-service/CLAUDE.md` | instagrapi-правила, ручная пагинация ленты, `_pk`/`_id`, сессии/прокси/ошибки |
| Docker / инфра | `docker/CLAUDE.md` | сервисы, порты, env, очереди/воркеры, масштабирование `automation-worker` |

On-demand доки (по ссылке, НЕ грузятся на старте):
- `docs/automation/architecture.md` — слои движка автоматизации, 9 таблиц, канонические инварианты (§2), статус реализации (§11).
- `docs/automation/plan.md` — поэтапный план (Phase 0 → MVP → …).
- `docs/orchestration/playbook.md` / `docs/orchestration/agent-factory.md` — детальный плейбук параллельного fan-out.
- `docs/orchestration/retrospective.md` — живой монитор-лог мультиагентных прогонов (kiro-cli + Codex + Claude-Agent).
- `docs/debug-protocol.md` — чек-лист ручных проверок с живым IG-аккаунтом.
- `docs/guides/realtime-websocket.md` · `docs/guides/llm-generation.md` · `docs/guides/pinia-store-pattern.md`.

## Docker Services (кратко; детали — `docker/CLAUDE.md`)
- `vue` → 9000 · `nginx` → 8000 (reverse proxy → laravel) · `python` → 8001 · `postgres` → 5432 · `redis` → 6379
- `reverb` → 8080 (WebSocket) · `laravel` (PHP-FPM за nginx) · `queue-worker` (очередь `default`) · `automation-worker` (очередь `automation`) · `scheduler`

## Environment
Root `.env`: `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `INSTAGRAM_SALT`
Frontend `.env`: `VITE_API_URL=http://localhost:8000/api/`
Laravel: `INSTAGRAM_PYTHON_URL=http://python:8001` (внутренний Docker URL)

## Data Flow
```
[Vue SPA] → [Laravel API] → [Python FastAPI] → [Instagram (instagrapi)]
                ↓
          [Redis Queue]
                ↓
          [GenerateCommentJob] → [LLM API (GLM / OpenAI)]
                ↓
          [Laravel Reverb] ←→ [Frontend (Echo + pusher-js)]
```

## User Preferences
- Answer in Russian
- Реализацию в файлах пишет Kiro-делегат (см. «Делегирование исполнителям»), НЕ главная модель
  руками. Пользователю — план/разбор/хинты, а не простыни кода в чат.
- No implementation without explicit request — plan first (санкция → план → делегирование)

## Коммиты
Формат — conventional commits: `тип(scope): краткое описание` (как в истории репо).
- Тип = действие: `feat` / `fix` / `docs` / `refactor` / `chore` / `test` / `perf`
- Scope в скобках — затронутая область: `automation`, `llm`, `claude-md`, `frontend`, …
- Заголовок ≤70 символов, без точки в конце
- После заголовка — пустая строка, далее описание списком с тире; пункты — глаголом
  прошедшего времени («Ужал», «Вынес», «Добавил»)
- Точки в конце пунктов не ставить; описание — по-русски, по существу
- Co-authored-by НЕ добавлять

## Безопасность (универсально, любой слой)
- Не логировать пароль, cookie, full session dump, API-ключи и прочие чувствительные данные.
- Instagram: rate-limit first — без массовых/агрессивных действий без явной бизнес-необходимости.

## Автоматизация / Бот — ЗАВЕРШЕНО
Парсер целей (хэштег/гео + источник `my_following`) + единый движок действий: **comment** (с
LLM-автогенерацией) / **like** / **follow** / **unfollow**; режимы полу-ручной и полностью-авто.
**Полностью собран и проверен на живом аккаунте.** Источник правды — `docs/automation/architecture.md`
(слои, 9 таблиц, канонические инварианты «НЕ нарушать» §2, статус реализации §11) + `docs/automation/plan.md`.

## Делегирование исполнителям — политика (приоритет по умолчанию)

**Термины (НЕ путать — это разные сущности).** *Субагенты* — копии Claude через Task/Agent-tool
(`Explore`, `Plan`, кастомные `.claude/agents/*`); грузят `CLAUDE.md`, умеют worktree «из коробки».
*Делегаты* — ВНЕШНИЕ агенты через MCP: **Kiro** (`mcp__kiro-cli__delegate/reply`) и **Codex**
(`mcp__codex__codex`). Это НЕ субагенты. Главная модель (Opus) — ОРКЕСТРАТОР: декомпозиция,
делегирование, ревью, швы. Реализацию руками НЕ пишет. Команда «используй максимум агентов»
двусмысленна — формулировать явно: «делегируй реализацию Kiro, сам только ревью/швы».

**Жёсткое разделение труда (закреплено хуком, не только текстом):**
- Главная модель пишет САМА только: coherence-швы (`src/router/routes.ts`, `src/layouts/AppNavTabs.vue`,
  `routes/api.php`, `routes/channels.php`, `app/Providers/*`), shared-слой (`src/shared/*`, `src/css/*`,
  `src/boot/*`), миграции, доки/память (`CLAUDE.md` / `docs/*` / `.claude/*`), конфиги; плюс
  декомпозиция, планы, ревью.
- ВСЯ реализация фич делегируется Kiro: фронт `src/{pages,widgets,entities,features,stores}/*`,
  бэк `app/*` (кроме `Providers`), python `python-service/**.py`. Сюда же — точечные правки по итогам
  ревью (через `reply` той же сессии воркера, а не своей рукой).
- **Enforcement.** PreToolUse-хук `.claude/hooks/guard-delegation.py` (рег. в `.claude/settings.json`)
  ФИЗИЧЕСКИ блокирует прямой Edit/Write/MultiEdit главной модели в зонах реализации — отдаёт `deny`
  с инструкцией делегировать. Kiro пишет файлы своим процессом В ОБХОД хука (внешний процесс не
  перехватывается) — делегатам не мешает. Граница: запись через `Bash` хук не ловит — обходить
  намеренно нельзя.

**Порядок нетривиальной задачи (>1 файла / любая реализация):** санкция → план → ДЕЛЕГИРОВАТЬ →
верифицировать ФАКТОМ (git diff / тесты) → свести. Чужой итог на веру не принимать.

**Каналы (строгий приоритет):**
1. **Kiro** (`mcp__kiro-cli`) — ПЕРВЫЙ, всегда. `delegate(task, workdir, model?, effort?)` — новая
   единица/сессия; `reply(session_id, task, workdir)` — продолжить ту же (НЕ плодить сессии). Проектный
   `CLAUDE.md` подмешивается автоматически. **Модель/мышление — ВЫЖИМАЕМ МАКСИМУМ:** дефолт
   `claude-opus-4.8` + `effort=max` ВСЕГДА (у Opus шкала `low<medium<high<xhigh<max`, потолок — `max`).
   Понижать на `claude-sonnet-4.6` — ТОЛЬКО для простых задач (фоновое тестирование, тривиальные
   проверки), и тоже с `effort=max` (у Sonnet нет `xhigh`, его потолок — `max`). `glm-5` — крайний случай.
2. **Codex** (`mcp__codex`) — ВТОРОЙ: независимое мнение, глубокий анализ, чтение реального репо. **Тоже
   на максимум:** `service_tier=priority` + `model_reasoning_effort=xhigh` (потолок reasoning у gpt-5.x),
   независимо от формулировки запроса. Продолжение — `codex-reply` по `threadId`.

Ревью оркестратора (`/code-review`, `/simplify`) — в его сессии; «второе мнение» можно отдать Codex,
синтез/решение — за Opus.

Параллелизм: независимые куски — разом, но по РАЗНЫМ каналам/директориям. **Per-account spacing Kiro:**
один Kiro-аккаунт сериализует вызовы (реальная одновременность = число живых аккаунтов `k`; сейчас
`k=1` → фан-аут через Kiro идёт ПОСЛЕДОВАТЕЛЬНО) — тяжёлый сустейнед-объём разводить по каналам.
**⚠️ Механизм в режиме теста** — любой сбой/нюанс делегата фиксировать в
`docs/orchestration/retrospective.md`. Детальный fan-out-плейбук — `docs/orchestration/playbook.md` / `docs/orchestration/agent-factory.md`.

## Проверка UI / визуальные регрессии — делегировать через live-check (Playwright)
Когда пользователь просит «протестировать интерфейс», сообщает «съехало / не туда нажалось / счётчик
врёт» или просит проверить UX-поведение — НЕ кликать вручную по DevTools, а делегировать прогон субагенту
(Kiro/Codex; для проверок ок `claude-sonnet-4.6` — быстрее), который гоняет headless-Playwright по ЖИВОМУ
сайту и возвращает реальные данные (ответы API, кадры WebSocket, состояние DOM/целей) — без моков.
- Харнес: `frontend-vue/scripts/live-check/automation-live.mjs`. Запуск на ХОСТЕ:
  `cd frontend-vue && node scripts/live-check/automation-live.mjs` (внутри контейнера `vue` WS до
  Reverb:8080 недостижим — только хост). Токен — свежий из живого `localStorage('token')`.
- Chrome DevTools (live-вкладка оркестратора) — только когда пользователь хочет ВИДЕТЬ клики в реальном
  времени.
- **Триал-период (первые ~10 делегированных прогонов):** оркестратор ПАРАЛЛЕЛЬНО прогоняет проверку сам и
  сверяет результат агента ФАКТОМ; каждый прогон + расхождения — в `docs/orchestration/retrospective.md`
  (там же счётчик прогонов). После обкатки — доверять агенту без дубля.
- Live-check дёргает живой Instagram (реальный парсинг) — объёмы минимальные, по необходимости; не в CI.
- **ПЕРЕД live-тестом после правок `app/Jobs/*` или `app/Services/*` — ОБЯЗАТЕЛЬНО `docker compose restart
  queue-worker automation-worker`:** `queue:work`-демоны кэшируют PHP-код в памяти, тесты гоняют свежий
  код и маскируют это — а живые воркеры останутся на старом коде (баг: offsets/skip «не применились»).

## Coherence-швы (держит оркестратор — НЕ делегировать враздрай)
- Эти memory-файлы: корневой `CLAUDE.md` + `AGENTS.md` (symlink на него).
- Кросс-сервисные контракты: Laravel API ↔ Python FastAPI ↔ Vue DTO/типы.
- `docker-compose.yml` — имена/порты/env сервисов.
- Backend: `backend-laravel/routes/api.php`, `app/Providers/AppServiceProvider.php`, `routes/channels.php`.
- Frontend-навигация: `frontend-vue/src/router/routes.ts`, `src/layouts/AppNavTabs.vue`; барелы `shared/ui/*`, `shared/lib/*`.
- Инварианты движка автоматизации (счётчик `FOR UPDATE`, `run_at`+диспетчер, CAS-claim, единый TZ) — `docs/automation/architecture.md §2`.
