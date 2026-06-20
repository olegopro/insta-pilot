# Автоматизация / Бот — Поэтапный план реализации

Архитектура и канонические решения — [AUTOMATION-ARCHITECTURE.md](AUTOMATION-ARCHITECTURE.md).
MVP-вертикаль: **комментарии по хэштегу/гео, полу-ручной режим**. Код в этом прогоне не написан —
план под последующую реализацию, разрешённую владельцем поэтапно.

Принцип фаз: **сначала вертикаль (узкий сквозной путь до рабочего результата), потом ширина**. Каждая
фаза заканчивается проверяемым результатом. Антибан-механики и инфра-предусловия идут в начале, потому
что без них движок либо не запускается, либо опасен для аккаунтов.

---

## Phase 0 — Инфраструктурные предусловия (БЛОКЕРЫ) ⚠️

Без этого движок физически не работает. Не frontend, не бизнес-логика — фундамент.

1. **Scheduler.** Добавить контейнер `scheduler` (`php artisan schedule:work`) в `docker-compose.yml`;
   зарегистрировать `withSchedule(...)` в `bootstrap/app.php`. (Каркас под диспетчер + reaper.)
2. **Очередь.** Согласовать `QUEUE_CONNECTION` с командой worker; завести отдельную очередь
   `automation` + свой worker (бот не должен конкурировать с `GenerateCommentJob`).
3. **Timeout-иерархия.** Развести `retry_after(queue) > job timeout > Http::timeout` (сейчас риск
   двойной выдачи Job).
4. **auth-context-free клиент.** Добавить `?int $userId` в action-методы `InstagramClientService`
   (`addLike`, `commentMedia`, при необходимости `getUserInfoByPk`); fallback на `auth()->id()` только
   если `null`. Зафиксировать правило в корневом `CLAUDE.md`.

**Готово, когда:** пустая команда-диспетчер крутится каждую минуту в контейнере `scheduler`; тестовый
Job, поставленный в очередь `automation`, исполняется выделенным воркером; метод клиента отрабатывает
из консольного контекста (без HTTP-сессии) с корректным `user_id` в логе.

---

## Phase 1 — MVP-вертикаль: комментарии по хэштегу/гео, полу-ручной режим 🎯

Цель: спарсить → посмотреть плитку/таблицу → удалить лишние → Старт → комментарии уходят
распределённо, с лимитом и рабочими часами. Узко, но сквозно и до конца.

### 1A. Данные
Миграции + модели + репозитории (`Interface→Impl→bind`): `parse_runs`, `parsed_targets`,
`automation_tasks`, `automation_action_items`, `account_action_limits`, `account_action_counters`,
`account_working_hours`, `account_target_interactions`. (`parse_filter_presets` можно отложить.)

### 1B. Python — парсинг
- `POST /parse/targets/candidates` (hashtag + location), `POST /parse/targets/enrich`.
- Хелперы `_fetch_user_medias_raw`, `_compute_target_metrics`, `_dedup_candidates_by_author`,
  `_serialize_target_user`. Юнит-тесты метрик (без Instagram).
- **Предусловие:** подтвердить формат `feed/user/{pk}/` на живом аккаунте (чек-лист
  `DEBUG_PROTOCOL.md`) — от него зависит экстрактор.

### 1C. Laravel — парсинг и отбор
- Обёртки `parseTargetsCandidates`/`parseTargetsEnrich` в `InstagramClientService`.
- `TargetFilterService` (пороги: followers/following min-max, свежесть, агрегаты лайков, бело/чёрные
  слова). Ранний follower-отсев между `candidates` и `enrich`.
- `ParseTargetsJob` + `AutomationTaskController` (`store`, `parseTargets`, `excludeTarget`/
  `restoreTarget` — корзина, `start`). Маршруты в группе `automation`.

### 1D. Laravel — движок (узко: только comment + like-задел)
- `ActionPluginInterface` + `ActionPluginRegistry` + `CommentActionPlugin` (resolve=LLM, execute=
  `commentMedia`).
- `RateLimitGuard` (счётчик + `FOR UPDATE` + резерв), `WorkingHoursService` (`isOpenNow`,
  `nextOpenSlot`), `ScheduleActionItemsJob`, диспетчер+reaper в `schedule()`, `ExecuteActionItemJob`.
- Классификация ошибок (3 ветки), backoff на `rate_limited`, идемпотентность (UNIQUE + CAS +
  reconcile, текст в payload до вызова), cooldown в `account_target_interactions`.
- `AutomationTaskProgress` event + канал + авторизация.

### 1E. Frontend — полу-ручная вертикаль
- shared/ui: `chips-input-component`, `number-range-component`, `segmented-control-component`,
  `working-hours-grid`, `time-distribution-preview`.
- entities: `automation-parsing`, `automation-target`, `automation-task`, `automation-settings`.
- features: `automation-source-config`, `automation-filter-config` (4 группы),
  `curate-automation-target` (корзина), `configure-automation-action` (CommentActionConfig),
  `start-automation-task`, `automation-task-live`, `configure-working-hours`,
  `configure-automation-limits`.
- widgets: `automation-builder`, `automation-targets-view` (таблица/плитка), `automation-launch-cockpit`,
  `automation-task-list`.
- page `automation` + seam: route + `q-route-tab`.

**Готово, когда:** на тестовом аккаунте полный путь работает — парсинг по хэштегу с фильтрами даёт
таблицу+плитку с аккаунтом и постом; удаление в корзину сохраняется (переживает reload); Старт
распределяет комментарии по окну в рабочих часах; дневной лимит и cooldown соблюдаются; прогресс идёт
по WebSocket; повторный запуск не комментирует одну цель/медиа дважды; на 429 аккаунт уходит в backoff,
а не залп.

---

## Phase 2 — Полностью автоматический режим

`full_auto`: `ParseTargetsJob` парсит с оверсэмплингом ×1.5–2, авто-отбирает прошедших, сразу зовёт
`ScheduleActionItemsJob` — без шага review. UI: тумблер режима в кокпите, «по Краснодару найди
фотографов, 100 комментариев → Старт». Логика исполнения переиспользуется целиком.

**Готово, когда:** один сабмит без ручного отбора доводит до распределённого исполнения; full_auto и
semi_auto делят один движок (различие только до планирования).

---

## Phase 3 — Лайки как второе действие (проверка переиспользования)

`LikeActionPlugin` (execute=`addLike`, «already liked» = success). Регистрация плагина, новый
`action_type` в UI — **движок/Jobs/диспетчер не меняются**. Это тест архитектуры на расширяемость.

**Готово, когда:** лайки работают добавлением только плагина + UI-опции, без правок ядра движка.

---

## Phase 4 — Рабочие часы и лимиты как полноценный UX

Модалка `working-hours-grid` (drag-select 7×24, TZ аккаунта), форма лимитов, превью распределения
(`time-distribution-preview`), индикатор стоимости парсинга. Бэкенд готов с Phase 1 — здесь доводка UX
и настроек на странице `automation/settings`.

---

## Phase 5 — Масштаб и надёжность

- Параллелизм по аккаунтам: несколько queue-воркеров (`replicas` в compose), проверка CAS-claim под
  конкуренцией.
- Python-кэш цели (короткий TTL) под полу-ручной цикл «спарсил → покрутил фильтры → пересчитал».
- `parse_filter_presets` (сохранённые наборы фильтров), история/архив прогонов.
- Reconcile-доводка `unknown→needs_review`, отчётность по скипам/лимитам.

---

## Phase 6 (бэклог) — Подписки/отписки

`Follow`/`UnfollowActionPlugin` + лимит `follows_per_day`. Источник целей может расшириться
(конкуренты, CSV-импорт) через тот же контракт источника. Каркас уже заложен.

---

## Карта параллелизуемости (fan-out)

После **Phase 0** и фиксации **контракта API** (пути endpoint'ов, формат пагинации, имена Reverb-
событий/каналов, snake_case payload — это первый шаг Phase 1, делается ДО fan-out) фазу 1 можно
разложить на параллельных субагентов в изолированных worktree (см. `ORCHESTRATION.md`):

| Поток | Трогает (в основном новые файлы) | Зависит от |
|-------|----------------------------------|------------|
| A. Данные (1A) | `database/migrations/*`, `app/Models/*`, `app/Repositories/*` | контракт схемы (§4 архитектуры) |
| B. Python (1B) | `python-service/*` | формат `feed/user` (живой аккаунт) |
| C. Laravel парсинг (1C) | новые Service/Job/Controller | A (модели), контракт Python |
| D. Laravel движок (1D) | новые `Automation/*`, Jobs, Event | A (модели), Phase 0 |
| E. Frontend (1E) | новые FSD-слайсы + `shared/ui/*` | контракт API (snake_case, каналы) |

**Швы — сериализовать, не отдавать параллельно** (оркестратор после слияния): `routes/api.php`,
`routes/channels.php`, `AppServiceProvider`/`AutomationServiceProvider` (bind плагинов),
`src/router/routes.ts`, `src/layouts/AppNavTabs.vue`, расширение существующих `index.ts`-barrel.

**Контракт shared/ui** (5 новых обёрток) — расширяется ОДИН раз до fan-out потока E (каждая обёртка =
своя папка + `index.ts`, аддитивно).

---

## Чек-лист «фиксируем ДО кода» (иначе слои разъедутся)

- [ ] Канонические имена таблиц/статусов (§4 архитектуры) — единые для всех.
- [ ] Механизм лимитов = счётчик + `FOR UPDATE` + `quota_reserved_at` (НЕ COUNT по логам).
- [ ] Модель времени = БД-строки `run_at` + диспетчер everyMinute (НЕ delay()-jobs).
- [ ] Единый TZ-источник на аккаунт (`account_working_hours.timezone`).
- [ ] auth-context-free сигнатуры `InstagramClientService`.
- [ ] Контракт API (endpoint-пути, пагинация, Reverb-каналы `automation-task.{taskId}`, payload).
- [ ] Подтверждён формат `feed/user/{pk}/` на живом аккаунте.
- [ ] Дефолты/потолки (§9 архитектуры) подтверждены владельцем.
