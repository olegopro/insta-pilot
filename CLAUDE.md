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
- User writes code themselves — give hints, not full implementations
- No implementation without explicit request — plan first

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

## Делегирование субагентам — политика (приоритет по умолчанию)
Главная модель — ОРКЕСТРАТОР, не единственный исполнитель. Как только задача больше тривиальной
(>1 файла, широкое чтение/анализ, ресёрч, второе мнение, объёмная правка) — сперва ДЕЛЕГИРОВАТЬ, потом
верифицировать и сводить. Это не отменяет «hints, not implementations» и «plan first» (они решают, ЧТО
показать пользователю); делегирование — это КАК выполнять санкционированную работу. Итог подаётся как
разобранный diff/итог; чужие черновики на веру не принимать — ВЕРИФИЦИРОВАТЬ фактом.

Каналы (строгий приоритет):
1. **Kiro CLI** (MCP `kiro-cli`) — ПЕРВЫЙ, всегда, с максимальным мышлением. `delegate(task, workdir,
   model?, effort?)` — новая сессия; `reply(session_id, task, workdir)` — продолжить ту же (НЕ плодить
   новые сессии). Проектный `CLAUDE.md` подмешивается автоматически. Модели: `claude-opus-4.8` по
   умолчанию → `claude-sonnet-4.6` когда Opus избыточен → `glm-5` крайний случай. Effort `max` по
   умолчанию (понижать только под явную скорость/дешевизну).
2. **Codex** (MCP `codex`) — ВТОРОЙ: независимое мнение, глубокий анализ, чтение реального репо. `config`
   (service_tier/effort) — по правилу глобального `CLAUDE.md`. Продолжение — `codex-reply` по `threadId`.

Параллелизм: независимые куски — разом, но по РАЗНЫМ каналам/директориям. **Per-account spacing Kiro:**
один Kiro-аккаунт сериализует вызовы — тяжёлый сустейнед-объём гнать через Codex/Claude-Agent.
**⚠️ Механизм в режиме теста** — любой сбой/нюанс агента (особенно Kiro CLI) фиксировать в
`docs/orchestration/retrospective.md`. Детальный fan-out-плейбук — `docs/orchestration/playbook.md` / `docs/orchestration/agent-factory.md`.

## Coherence-швы (держит оркестратор — НЕ делегировать враздрай)
- Эти memory-файлы: корневой `CLAUDE.md` + `AGENTS.md` (symlink на него).
- Кросс-сервисные контракты: Laravel API ↔ Python FastAPI ↔ Vue DTO/типы.
- `docker-compose.yml` — имена/порты/env сервисов.
- Backend: `backend-laravel/routes/api.php`, `app/Providers/AppServiceProvider.php`, `routes/channels.php`.
- Frontend-навигация: `frontend-vue/src/router/routes.ts`, `src/layouts/AppNavTabs.vue`; барелы `shared/ui/*`, `shared/lib/*`.
- Инварианты движка автоматизации (счётчик `FOR UPDATE`, `run_at`+диспетчер, CAS-claim, единый TZ) — `docs/automation/architecture.md §2`.
