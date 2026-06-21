# Автоматизация / Бот — Архитектура

Статус: **проект (design)**, код не написан. Источник: мультиагентный прогон (Workflow Opus ×9 +
Codex + Kiro-Opus/Sonnet), сведённый оркестратором. Ретроспектива прогона —
[ORCHESTRATION-RETROSPECTIVE.md](ORCHESTRATION-RETROSPECTIVE.md). Поэтапный план —
[AUTOMATION-PLAN.md](AUTOMATION-PLAN.md).

MVP-вертикаль (реализуется первой): **комментарии по хэштегу/гео, полу-ручной режим**.

---

## 1. Что строим

Блок «Автоматизация» — это **парсер целей** + **переиспользуемый движок действий** поверх уже
существующих примитивов проекта (поиск по хэштегу/локации, лайк, комментарий, LLM-генерация,
activity-логи, сессии/прокси аккаунтов). Laravel ничего нового про Instagram не «умеет» — он
оркеструет: парсит через Python, материализует цели и под-действия в БД, распределяет их во времени
с учётом дневных лимитов и рабочих часов, исполняет через очередь.

Два режима — **одна конвейерная машина**, различие только в наличии шага ручного отбора:

```
                 ┌─────────────── ПОЛУ-РУЧНОЙ ───────────────┐
 источник+фильтры │  PARSE → [корзина: ручной отбор целей] →   │ START → SCHEDULE → EXECUTE
 + объём + действие│                                            │
                 └─────────────── ПОЛНОСТЬЮ АВТО ─────────────┘
                    PARSE → (авто-отбор всех прошедших) ──────── START → SCHEDULE → EXECUTE
```

Конвейер из 4 стадий:

1. **PARSE** — собрать кандидатов из источника, обогатить профилем + последними N постами, посчитать
   метрики, отфильтровать (AND-комбинация), сохранить как `parsed_targets`.
2. **REVIEW** (только полу-ручной) — пользователь смотрит таблицу/плитку, удаляет лишние цели в
   корзину (`status = trashed`), жмёт «Старт».
3. **SCHEDULE** — отобранные цели → `automation_action_items` с `run_at`, распределёнными по окну
   (час/два) с джиттером в рабочих часах аккаунта.
4. **EXECUTE** — диспетчер раз в минуту берёт «созревшие» под-действия и исполняет через плагин
   действия, соблюдая дневной лимит и рабочее окно на **момент исполнения**.

---

## 2. Канонические решения (разрешение конфликтов между агентами)

Независимые дизайн-агенты разошлись по нескольким несущим вопросам. Ниже — **единственно верный**
вариант для всех слоёв; фиксируется ДО любого кода, иначе миграции/слои разъедутся.

| # | Вопрос | Расхождение агентов | КАНОНИЧЕСКОЕ решение | Почему |
|---|--------|---------------------|---------------------|--------|
| 1 | Распределение во времени | delay()-Job на каждое под-действие (Kiro-Opus, engine-агент) **vs** строки `status=scheduled`+`run_at` + диспетчер everyMinute (Codex, DB-агент) | **БД-driven диспетчер.** Каждое под-действие — строка с `run_at`; scheduler раз в минуту выбирает созревшие, диспатчит Job. delay()-Job **отвергнут**. | delay()-Job после простоя дают catch-up storm (залп вне рабочих часов), их нельзя отменить, плохо переживают рестарт |
| 2 | Учёт дневных лимитов | COUNT по `account_activity_logs` (engine-агент) **vs** отдельная таблица-счётчик + `FOR UPDATE` (DB-агент, Codex, критик) | **Таблица-счётчик `account_action_counters` + `SELECT … FOR UPDATE` + резерв ДО IG-вызова.** Логи — только аудит. | COUNT по логам: гонка между проверкой и записью, лог пишется ПОСЛЕ действия, логи чистятся (расход «исчезнет»), нет атомарного резерва |
| 3 | userId в Job-контексте | не замечено никем, кроме критика | **`InstagramClientService` сделать auth-context-free:** добавить явный `?int $userId` в action-методы, Job передаёт `task.user_id`. | Сейчас методы берут `(int) auth()->id()` ВНУТРИ — в очереди вернёт `null→0`, ломает ownership логов и учёт лимитов. **Блокер.** |
| 4 | Имена таблиц/статусов | два набора имён (`parsed_targets`/`automation_action_items` vs `automation_targets`/`automation_sub_actions`) | **Один канонический набор** (см. §4). | Иначе fan-out даст несовместимые миграции |
| 5 | TZ рабочих часов и границы суток | account-tz / app-tz / user-tz | **Один TZ на аккаунт**, хранится в `account_working_hours.timezone`; им же считается `local_date` для счётчика лимита. | Если TZ окна и TZ счётчика разойдутся, сутки лимита «поедут» относительно рабочего окна |
| 6 | Дедуп целей | только внутри одного прогона (оба backend-агента) | **Плюс глобальный cooldown между прогонами** (`account_target_interactions`). | Повторное касание одного пользователя через неделю другой задачей — сильный спам-сигнал Instagram |
| 7 | Идемпотентность действия | exactly-once предполагалось наивно | **UNIQUE(account, action, media_pk) + CAS-claim + reconcile**; неоднозначное (timeout/смерть воркера) → `unknown`/`needs_review`, без авто-дубля. like: «already liked» = success. | `media_comment` НЕ идемпотентен — IG не даёт idempotency-key; дубль коммента опаснее дубля лайка |

---

## 3. Инфраструктурные предусловия (без них движок не работает — БЛОКЕРЫ)

Найдено критиком, не покрыто ни одним дизайном слоёв. Это **Phase 0** плана.

1. **Scheduler-контейнер.** Оба backend-дизайна строят исполнение на `schedule()->everyMinute()`
   (диспетчер due-под-действий + reaper «осиротевших» claimed). В `docker-compose.yml` нет
   контейнера `php artisan schedule:work`, в `bootstrap/app.php` нет `->withSchedule(...)`.
   Планировщику физически негде крутиться. **Добавить контейнер `scheduler` + регистрацию команд.**
2. **Драйвер очереди.** `config/queue.php` default = `database`, а worker в compose запущен как
   `queue:work redis`. Dispatch и listen могут разойтись → задачи не исполнятся. **Привести в
   соответствие** и завести **отдельную очередь `automation`** + свой worker, чтобы бот не
   конкурировал с `GenerateCommentJob` на единственном текущем воркере.
3. **Timeout-иерархия.** Строго `retry_after(queue) > job timeout > Http::timeout(Laravel→Python)`.
   Сейчас `GenerateCommentJob` имеет `timeout=90`; если `retry_after` очереди тоже 90 — job
   переотдаётся пока процесс жив → двойное действие. **Развести значения.**
4. **auth-context-free клиент** (решение §2.3) — предусловие исполнения ЛЮБОГО действия из очереди.
5. **Параллелизм по аккаунтам** — несколько queue-воркеров. Сейчас один. Это инфра-задача
   (compose `replicas`), не код; CAS-claim её выдержит. Для MVP достаточно одного воркера.

---

## 4. Слой данных (PostgreSQL) — 9 новых таблиц

Конвенции проекта: `bigIncrements` PK, ownership через `user_id` (cascadeOnDelete), привязка к
аккаунту через `instagram_account_id` (constrained), статусы — строки (не БД-enum), json-cast для
структурированных полей, шифрование не требуется (креды живут в `instagram_accounts`).

### 4.1 Парсинг

**`parse_filter_presets`** — переиспользуемый набор «источник + фильтры» (опционально, удобство).
- `user_id`; `title`; `source_type` (`hashtag|location|hashtag_location|hashtag_list`);
  `source_value` json; пороги фильтров (см. ниже) как nullable-поля; `is_active`; timestamps.

**`parse_runs`** — один запуск парсинга (исполнение).
- `user_id`, `instagram_account_id` (чьей сессией парсим), `parse_filter_preset_id` nullable;
  `mode` (`semi_auto|full_auto`); `source_type`, `source_value` json;
  `filters_snapshot` json (полный снимок порогов на момент запуска — повторяемость/аудит);
  `target_limit` (сколько целей собрать); `status` (`pending|running|completed|failed|cancelled`);
  `scanned_count` / `collected_count` (прозрачность стоимости: «просмотрено 200 → прошло 47»);
  `next_cursor` json nullable (докачка источника); `error_message`; `started_at`/`finished_at`.
- Индексы: `[user_id, id]`, `[instagram_account_id, id]`, `status`.

**`parsed_targets`** — денормализованный снимок «аккаунт-цель + опорный пост + метрики».
- `parse_run_id`, `user_id` (денорм. ownership);
  цель: `target_user_pk`, `target_username`, `target_full_name`, `target_profile_pic_url`,
  `follower_count`, `following_count`, `media_count`, `is_private`, `is_verified`;
  опорный пост: `media_pk`, `media_id` (составной `{media_pk}_{user_pk}` — готов к
  `addLike`/`commentMedia`), `media_caption`, `media_like_count`, `media_comment_count`,
  `media_taken_at`;
  `metrics_snapshot` json (`likes_sum`, `likes_avg`, `likes_min`, `likes_max`, `last_post_age_days`,
  `matched_words`); `status` (`kept|trashed`) default `kept` — **корзина полу-ручного режима**.
- UNIQUE `[parse_run_id, target_user_pk]` (дедуп внутри прогона);
  индексы `[parse_run_id, status]`, `[user_id, id]`.
- Решение: денормализация, а не FK на IG-сущности — данные Instagram эфемерны, нужен срез на момент
  парсинга; `media_id` хранится уже составным.

### 4.2 Движок задач

**`automation_tasks`** — родительская задача.
- `user_id`, `instagram_account_id` (исполнитель), `parse_run_id` nullable (источник целей);
  `mode` (`semi_auto|full_auto`); `action_type` (`comment|like|follow|unfollow` — плагин);
  `action_config` json (для comment — llm-настройки/тон/шаблон);
  `target_count`; `spread_seconds` default 3600 (окно распределения, час/два);
  `jitter_seconds`; `respect_working_hours` bool default true;
  `status` (`draft|scheduling|running|paused|completed|failed|cancelled`);
  `items_total`/`items_done`/`items_failed`/`items_skipped`; `started_at`/`finished_at`.
- Индексы: `[user_id, id]`, `[instagram_account_id, status]`, `status`.

**`automation_action_items`** — атомарное под-действие (контракт плагина, источник истины).
- `automation_task_id`, `instagram_account_id` (денорм.), `user_id` (денорм.),
  `parsed_target_id` nullable; `action_type`; `target_user_pk`;
  `media_id` (готовый составной id); `payload` json (вход плагина: текст коммента/параметры);
  `result` json (выход: `comment_pk` и т.п.);
  `status` (`pending|scheduled|running|done|failed|skipped`) default `pending`;
  `run_at` timestamp (планируемый момент с джиттером, в рабочем окне);
  `claim_token` uuid nullable, `claimed_at`, `claim_expires_at` (CAS-захват одним воркером);
  `quota_reserved_at` nullable (резерв лимита — защита от двойного списания при ретрае);
  `attempts`; `error_code`, `error_message`; `activity_log_id` nullable (связь с
  `account_activity_logs` выполненного действия); `executed_at`.
- **UNIQUE `[instagram_account_id, action_type, media_pk]`** — идемпотентность (второй коммент/лайк к
  тому же media запрещён на уровне БД).
- Индексы: `[status, run_at]` (выборка созревших диспетчером), `[automation_task_id, status]`,
  `[instagram_account_id, status]`.

### 4.3 Лимиты, рабочие часы, антиспам

**`account_action_limits`** — конфиг порогов на аккаунт.
- `instagram_account_id`, `user_id`, `action` (`like|comment|follow|unfollow`);
  `daily_limit`; `min_action_spacing_sec` nullable (анти-burst между любыми действиями аккаунта);
  `is_active`. UNIQUE `[instagram_account_id, action]`.

**`account_action_counters`** — атомарный счётчик расхода (суммарно по ВСЕМ задачам аккаунта).
- `instagram_account_id`, `action`, `local_date`, `used` default 0.
- UNIQUE `[instagram_account_id, action, local_date]` — ключ резерва.
- Расход дня = `used` по строке `(account, action, today)`. Проверка: `SELECT … FOR UPDATE`, если
  `used < daily_limit` → инкремент в той же транзакции **ДО** IG-вызова. Откат — только если точно
  известно, что действие не дошло до Instagram. Новая дата = новая строка (сброс не нужен).

**`account_working_hours`** — рабочее окно.
- `instagram_account_id`, `user_id`; `schedule` json (матрица 7×24 bool — дни недели × часы);
  `timezone` string default `UTC` (**единый источник TZ** для окна И границы суток лимита);
  `is_enabled`. UNIQUE `[instagram_account_id]`.

**`account_target_interactions`** — глобальный cooldown повторного касания (антиспам между прогонами).
- `instagram_account_id`, `target_user_pk`, `action`, `last_touched_at`.
- UNIQUE `[instagram_account_id, target_user_pk, action]`. Парсер/планировщик исключает цели,
  тронутые этим аккаунтом за последние N дней (дефолт 30–60).

---

## 5. Python-слой — парсинг и обогащение

Принцип: Python остаётся **тонким парсером без бизнес-логики отбора**. Пороги (followers, дни,
бело/чёрные списки) применяет Laravel — их меняют в UI без редеплоя Python. Python отдаёт сырые
метрики + сериализованные данные.

**Два endpoint'а вместо одного «толстого»** (ключ к контролю стоимости запросов к Instagram):

1. **`POST /parse/targets/candidates`** — дёшево. Собирает уникальных авторов из источника.
   Вход: `session_data`, `source_type`, `query`/`hashtags[]`/`location_pk`, `amount` (постов
   источника, дефолт 30, **cap 90**), `next_max_id`. Делает 1 проход `_fetch_sections` поверх
   готовых `/search`, дедуп по `user.pk`, отдаёт `candidates[]` (`user_pk`, `username`,
   `anchor_post{...}`) + `next_max_id`. **Стоимость: 1 IG-запрос на страницу источника, обогащения
   нет.** Для `hashtag_list` перебирает теги последовательно, накапливая дедуп-пул.

2. **`POST /parse/targets/enrich`** — дорого. Обогащает список `user_pk`.
   Вход: `targets[]`, `last_n` (постов для агрегатов лайков, дефолт 6, набор {5,6,10,12},
   **cap 12**), `include_user_media` (можно пропустить медиа для лёгкого режима). Для каждой цели —
   `try/except` → `user_info` → (опц.) `last_n` медиа → метрики. **Стоимость: ~2 IG-запроса на цель**
   (`user_info` + 1 страница медиа). **Cap targets за вызов ~8–20** (баланс бюджета и времени под
   `account_lock`; согласовать с `Http::timeout` Laravel).

Новые хелперы (чистые, тестируемые без Instagram):
- `_fetch_user_medias_raw(cl, user_pk, amount)` — забор через `private_request 'feed/user/{pk}/'`
  (формат подтвердить на живом аккаунте, чек-лист `DEBUG_PROTOCOL.md`), переиспользует `_extract_posts`
  → `_serialize_media`. **НЕ** `cl.user_medias` (отдаёт Media-модели, несовместимо с raw-dict).
- `_compute_target_metrics(serialized, now)` → `last_post_age_days`, `likes_sum_last_n`,
  `likes_avg_last_n`, `likes_min/max`, `posts_analyzed`, `captions_concat`.
- `_dedup_candidates_by_author(posts, seen_pks)`, `_serialize_target_user(user)`.

`InstagramClientService` получает обёртки `parseTargetsCandidates` / `parseTargetsEnrich` (по паттерну
`searchHashtag`), все логируют + `maybeDeactivateAccount`.

### Порядок фильтрации (дёшево → дорого) — Codex

1. Дедуп `media_pk`, затем дедуп/cooldown `target_user_pk` (`account_target_interactions`).
2. Дешёвые media-фильтры из ответа источника: `taken_at` опорного поста, `caption_text`,
   `like_count` поста, `location_pk`, тип медиа. **0 доп. запросов.**
3. БД-фильтры: уже обработан, в blacklist, дневной лимит почти исчерпан.
4. `user_info`: followers/following/media_count/is_private/biography. **~1–2 запроса/цель.**
5. `user_medias(N)`: строгая свежесть последнего поста, агрегаты лайков, слова в постах.
   **~1 запрос/цель.**
6. LLM-генерация → 7. финальное действие.

**Пред-фильтр по `follower_count` ДО дорогого enrich — обязателен.** Грубая оценка: 100 финальных
целей при pass-rate ~30% ≈ 330 кандидатов → при всех фильтрах легко **600–1000 IG-запросов** — зона
высокого anti-ban риска. Отсюда жёсткие потолки и оверсэмплинг ×1.5–2 с ранней остановкой.

---

## 6. Laravel-движок действий

### 6.1 Контракт плагина (переиспользуемое ядро)

`App\Contracts\ActionPluginInterface`:
- `key(): string` — `comment` | `like` | …
- `limitKey(): string` — какой счётчик инкрементить (`comments` | `likes` | …)
- `estimatedCost(): int` — вес для дневного лимита (обычно 1)
- `resolve(AutomationActionItem $item): array` — дозабор ДО вызова: для `comment` — генерация текста
  через `LlmServiceInterface::generateComment` (переиспользование!), актуализация `media_id`. Текст
  фиксируется в `payload` **до** IG-вызова (нужно для reconcile).
- `execute(InstagramAccount $account, array $resolved, int $userId): array` — единственное место
  вызова `InstagramClientService` (`commentMedia`/`addLike`). `userId` передаётся явно (см. §2.3).
- `reconcile(AutomationActionItem $item): string` — для `unknown`: сверяет факт (например, fetch
  комментов media) → `done` / `retry` / `needs_review`.

Реализации: `CommentActionPlugin` (MVP), `LikeActionPlugin` (`like` фактически идемпотентен —
«already liked» = success). Задел: `FollowActionPlugin`/`UnfollowActionPlugin`. Регистрация —
тегированный массив в `AutomationServiceProvider`; добавление действия = новый плагин **без правок
движка**. Резолв по `action_type` — `ActionPluginRegistry`.

### 6.2 Jobs и диспетчер

- **`ParseTargetsJob`** — парсит источник (`candidates` → ранний follower-отсев → `enrich` батчами),
  применяет `TargetFilterService` (пороги), пишет `parsed_targets`, broadcast прогресса. По
  завершении: semi-auto → `parse_runs.status=completed` и ждёт ручного старта; full-auto → сразу
  планирование.
- **`ScheduleActionItemsJob`** — из `kept`-целей материализует `automation_action_items` с `run_at`,
  распределяя по `spread_seconds` с джиттером и анти-burst интервалом, привязывая к ближайшим
  открытым слотам `account_working_hours`. Статус задачи → `running`.
- **Диспетчер** — `Console`-команда в `schedule()->everyMinute()`: выбирает
  `status=scheduled AND run_at<=now AND рабочее окно открыто` (`FOR UPDATE SKIP LOCKED`), диспатчит
  `ExecuteActionItemJob` в очередь `automation`. **Reaper** в той же команде: `claimed` с
  `claim_expires_at<now` → `reconcile`/возврат в `scheduled`.
- **`ExecuteActionItemJob`** (`tries`=N означает «довести до терминального статуса», не «N раз дёрнуть
  Instagram»):
  1. Перечитать item + `task.status` (если `paused/cancelled` → выйти).
  2. `RateLimitGuard::reserve(account, limitKey)` — `FOR UPDATE` + проверка окна и лимита. При отказе
     → `skipped(skip_limit|skip_hours)` без расхода, либо перенос `run_at` на следующий открытый слот.
  3. CAS-claim (`UPDATE … WHERE status=scheduled`).
  4. `plugin.resolve()` (LLM-текст для comment).
  5. `plugin.execute()` → IG (внутри уже логируется в `account_activity_logs`).
  6. По результату: commit/release счётчика, запись `activity_log_id`, `done|failed|unknown`,
     выставить cooldown (`account_target_interactions`), broadcast `AutomationTaskProgress`.

### 6.3 RateLimitGuard (единый сквозной барьер)

`reserve()` в одной транзакции: `SELECT … FOR UPDATE` строки `account_action_counters` →
если `used < daily_limit` → инкремент, проставить `quota_reserved_at` на item → commit. Ретрай с уже
проставленным `quota_reserved_at` не инкрементит повторно. Граница суток (`local_date`) — в TZ
аккаунта из `account_working_hours.timezone`. Лимит — **суммарно по всем задачам** (ключ привязан к
account+action+date, не к задаче).

### 6.4 Классификация ошибок (3 ветки) — критично для антибана

- `media_not_found` / `user_private` → `skip(target_gone)`, **без** расхода лимита и без backoff
  аккаунта. Не ретраить, reconcile не нужен.
- `rate_limited` / `feedback_required` → **backoff аккаунта**: пауза всех `scheduled` под-действий
  аккаунта на 30–60+ мин (перенос `run_at`), circuit-breaker на парсинге. Аккаунт НЕ деактивировать.
- `login_required` / `challenge_required` → деактивация аккаунта (`maybeDeactivateAccount` уже это
  делает) + авто-pause его задач.

Сейчас `maybeDeactivateAccount` реагирует только на login/challenge; `rate_limited` оставляет аккаунт
активным и движок шлёт следующие действия залпом → эскалация. **Backoff на 429 — обязателен.**

---

## 7. Realtime

Новое событие `AutomationTaskProgress implements ShouldBroadcastNow` (точная калька
`CommentGenerationProgress`): `PrivateChannel automation-task.{taskId}`, поля
`status/items_total/items_done/items_failed/items_skipped/current_action`. Авторизация канала в
`routes/channels.php` по владельцу `automation_tasks.user_id`. Frontend — калька
`useCommentGeneration` (`echo.private().listen('.AutomationTaskProgress')` + `leave` +
`onBeforeUnmount`); после reconnect синхронизация через `fetchTask` (Echo не гарантирует доставку
пропущенных событий).

---

## 8. Frontend (Vue 3 + Quasar + FSD)

Новый FSD-домен поверх существующих паттернов, без дублирования media-post/instagram-account/shared.
Доступ — **user-level** (лимиты/часы привязаны к аккаунтам пользователя), не admin.

### 8.1 Дерево слайсов

```
pages/
  automation/            AutomationPage.vue — табы Конструктор / Задачи / Настройки
entities/
  automation-parsing/    черновик конфигурации парсинга (source/filters/targetCount) в store.ref
  automation-target/     спарсенная цель + статус отбора; *ListDTO + *TableColumns
  automation-action/     контракт action-плагинов (comment MVP, like/follow disabled-future)
  automation-task/       запущенная задача + прогресс
  automation-settings/   лимиты + рабочие часы
features/
  automation-source-config/   выбор источника (хэштег/гео/+гео/список) — ChipsInput + поиск локаций
  automation-filter-config/    4 группы комбо-фильтров
  automation-cost-preview/     индикатор стоимости IG-запросов (Низкая/Средняя/Высокая)
  curate-automation-target/    корзина: удаление/восстановление целей (PATCH status)
  configure-automation-action/ настройка действия (CommentActionConfig — MVP)
  preview-automation-schedule/ превью распределения по времени
  start-automation-task/       режим (полу-ручной/авто) + Старт
  automation-task-live/        realtime по образцу useCommentGeneration
  automation-task-control/     пауза/продолжение/отмена
  configure-automation-limits/ форма дневных лимитов
  configure-working-hours/     модалка рабочих часов
widgets/
  automation-builder/        источник+фильтры+объём+стоимость
  automation-targets-view/    таблица/плитка целей (адаптация target→MediaPost ЗДЕСЬ, не в entity)
  automation-launch-cockpit/  кокпит запуска: действие + цели + превью времени + Старт
  automation-task-list/       список задач с realtime-прогрессом
  automation-account-settings/ лимиты + кнопка рабочих часов
```

### 8.2 Новые shared/ui-обёртки (аддитивно, отдельными папками — не seam)

- `working-hours-grid` — сетка дни×часы, drag-select, `v-model` матрицы `boolean[7][24]`.
- `time-distribution-preview` — таймлайн-превью распределения N действий с джиттером.
- `chips-input-component` — обёртка над `q-select multiple use-input` (хэштеги, бело/чёрные слова).
- `number-range-component` — пара min/max (подписчики, среднее лайков).
- `segmented-control-component` — обёртка над `q-btn-toggle` (режим задачи, переключатель таблица/плитка).

Переиспользуется: `PageComponent`, `TableComponent`, `TableToolsWrapper`, `MasonryGrid`, `MediaCard`,
`AccountSelectComponent`, `useApi`, `useModal`, `useFilterColumns`, `echo`, `notify`.

### 8.3 Организация формы фильтров (Kiro-Sonnet)

4 группы, каждый фильтр **OFF по умолчанию** (чтобы не множить IG-запросы), у заголовка группы —
`FilterBadge` со счётчиком активных полей:

```
┌─ Источник ────────────────────────────────────────────┐
│ [● Хэштег] [○ Гео] [○ Хэштег+Гео] [○ Список]          │
│ [#фотограф, #свадьба …]   + Гео: [Москва ▼]            │
└───────────────────────────────────────────────────────┘
▼ Аудитория ··········· badge(2)   Подписчики [min–max]  Подписки [min–max]
▼ Анализ контента ····· badge(0)   Последний пост ≤ [N] дней
                                    Лайки: сумма по 5 / по 10 [min]
                                    Среднее лайков за [N] постов [min–max]
▼ Ключевые слова ······ badge(3)   Белый список [chips]  Чёрный список [chips]
──────────────────────────────────────────────────────────
Собрать целей: [ 200 ]              [ Старт парсинга ]   ← sticky footer
```

### 8.4 Швы (последовательно, оркестратором после слияния слайсов)

`src/router/routes.ts` (3 child-route под `MainLayout`: `automation`, `automation/tasks`,
`automation/settings`) и `src/layouts/AppNavTabs.vue` (`q-route-tab to=/automation label="Автоматизация"`,
user-level).

---

## 9. Открытые продуктовые решения (с рекомендованными дефолтами)

Не блокируют старт, но нужны до реализации соответствующих кусков. Дефолты — рекомендация
оркестратора, требуют подтверждения владельцем.

| Решение | Рекомендованный дефолт |
|---------|------------------------|
| Дневные лимиты | like 80–100/день, comment 30/день, follow 50/день — конфигурируемо на аккаунт; новый аккаунт сидится дефолтами; **fail-safe: нет строки лимита → действие запрещено** |
| Cooldown повторного касания | 30–60 дней на (аккаунт, цель, действие) |
| `last_n` (выборка лайков) | набор {5, 6, 10, 12}, дефолт 6, **cap 12** |
| `amount` источника / `target_count` | amount cap 90; target_count cap ~200; оверсэмплинг ×1.5–2 с ранней остановкой |
| Окно распределения | `spread_seconds` 5400 (1.5 ч) дефолт, джиттер ±, анти-burst spacing ≥ 60 с |
| Семантика «хэштег+гео» | композиция в Laravel (пересечение `user_pk` двух источников `candidates`), Python остаётся простым; гео = `location_pk` поста |
| Политика `unknown` для коммента | пометить `needs_review`, показать в UI для ручного решения; авто-reconcile с задержкой на индексацию IG — этап 2 |
| Где генерировать текст коммента | лениво в `resolve()` перед вызовом (свежее, разнообразнее), но **зафиксировать в payload до execute** |
| Доступ к блоку | user-level (не admin) |

---

## 10. Карта переиспользования (что НЕ пишем заново)

- **`InstagramClientServiceInterface`** — единственная точка IG. Готово: `searchHashtag`,
  `searchLocations`, `searchLocationMedias` (сбор), `addLike` (лайк), `commentMedia` (коммент),
  `getUserInfoByPk` (профиль). Добавить: `parseTargetsCandidates`, `parseTargetsEnrich`. Все логируют
  + `detectStatus` + `maybeDeactivateAccount`.
- **`ActivityLoggerService`** — действия движка логируются автоматически внутри методов IG-сервиса;
  новый action — просто та же строка `comment`/`like`, фронт-фильтры активности работают без правок.
- **`LlmServiceInterface::generateComment`** — переиспользуется в `CommentActionPlugin::resolve()`.
- **`GenerateCommentJob`** — структурный образец `ExecuteActionItemJob` (tries/timeout/try-catch/
  broadcast/activityLogger).
- **`CommentGenerationProgress`** + comment-job-owner кэш + проверка владельца в `channels.php` —
  образец `AutomationTaskProgress`.
- **`InstagramAccountRepository::findByIdAndUser`** — обязательная проверка владельца во всех
  контроллерах задачи.
- **Python `helpers._serialize_media` / `_fetch_sections` / `_make_client` / `account_lock`** — основа
  новых parse-endpoint'ов без переписывания пагинации/сериализации.
- **Frontend**: `TableComponent` + `*ListDTO` + `*TableColumns` (таблица целей), `MasonryGrid` +
  `MediaCard` (плитка), паттерн store (`searchStore`/`accountStore`), `activity-live` (образец
  realtime-подписки).

---

## 11. Статус реализации (проверено на живом аккаунте)

> Перенесено из корневого `CLAUDE.md` при разбивке документации на паутину. Канонические инварианты
> движка — выше, в §2; здесь — история готовности и живых проверок.

**MVP готов и проверен** (Wave 1–3; комментарии хэштег/гео, полу-ручной режим). Слой данных (9 таблиц +
модели + репозитории); Python-парсинг (`POST /parse/targets/candidates|enrich` + хелперы метрик);
Laravel-движок (контракт `ActionPluginInterface`, `Comment`/`LikeActionPlugin`, `RateLimitGuardService`
со счётчиком `account_action_counters` + `FOR UPDATE`, `WorkingHoursService`, `ActionSchedulerService`,
`ScheduleActionItemsJob`/`ExecuteActionItemJob`, команда-диспетчер `automation:dispatch` каждую минуту,
событие `AutomationTaskProgress`); Laravel-парсинг (обёртки клиента, `TargetFilterService`,
`ParseTargetsJob`, `AutomationTaskController` + `AutomationSettingsController`); фронтенд (FSD: 5
`shared/ui`-обёрток + entity/feature/widget + страница `/automation` + таб в `AppNavTabs`). Очередь
`automation` (отдельный воркер), `retry_after=300` > job timeout. Проверено: BE 231 / PY 176 тестов
зелёные, `vue-tsc` чисто, 14 маршрутов, UI вживую (Chrome) + API-roundtrip. **Проверено вживую на
реальном аккаунте** (3 задачи): парсинг (candidates+enrich по реальному IG), корзина, запуск, диспетчер
`automation:dispatch`, исполнение — опубликованы реальный комментарий и реальный лайк; лимиты
(`FOR UPDATE`+откат), cooldown, идемпотентность, очереди (default+automation) работают. Движок
action-agnostic (comment/like — один конвейер, разные плагины). Caveat: авто-генерация текста коммента
требует настроенного LLM-провайдера (`llm_settings` — задаётся владельцем; без ключа `resolve` падает
понятной ошибкой, исполнение через готовый `comment_text` — ок). **Грабли:** `queue:work` кэширует код —
после правок рестартить queue-worker И automation-worker.

**Phase 2 (полностью-авто) — готова и проверена живьём:** full_auto (`СТАРТ (АВТО)`) парсит и САМ
планирует исполнение (`ParseTargetsJob` авто-диспатчит `ScheduleActionItemsJob`, без ручного `/start`),
UI уходит на вкладку «Задачи» с realtime-прогрессом; выбор действия (комментарий/лайк) в конструкторе;
review-таблица авто-обновляется после async-парсинга (`useParseProgress`: подписка
`.AutomationTaskProgress` + fallback-поллинг). Идемпотентность: `ActionSchedulerService` под
`lockForUpdate` не дублирует планирование, `/start` идемпотентен.

**Phase 4 (UX настроек) — готова и проверена живьём:** вкладка «Настройки» грузит/сохраняет дневные
лимиты (PUT в `account_action_limits`) и рабочие часы (модалка-сетка 7×24 + TZ → `account_working_hours`),
рабочие часы **enforced** планировщиком (`run_at` сдвигается на начало открытого окна). Весь блок
«Автоматизация» проверен на живом аккаунте от парсинга до исполнения (реальные коммент+лайки), вкл.
полу-ручной и полностью-авто, лимиты/часы/cooldown/идемпотентность.

**Phase 6 (подписки) — follow готов и проверен живьём:** Python `/user/follow` + `/user/unfollow`,
`InstagramClientService::followUser/unfollowUser` (по образцу `addLike`), `Follow`/`UnfollowActionPlugin`
(зарегистрированы в теге `automation.plugins`); follow проверен на живом аккаунте (реальная подписка,
`friendship_status.following=true`). Полный набор действий **comment/like/follow** работает через один
движок (расширяемость плагинами подтверждена).

**Unfollow — готов и проверен живьём:** добавлен источник `my_following` (Python `POST /user/following`
→ `cl.user_following(cl.user_id)`; ветка в `ParseTargetsJob`; в UI при выборе «Отписка» источник =
`my_following`, выбор хэштега/гео скрыт). Реальная отписка подтверждена (`friendship_status.following=
false`). Лимиты follow/unfollow в форме настроек. Источник `my_following` — единственный, где цели без
media (отписка от текущих подписок аккаунта).

**Phase 5 (масштаб) — готов:** `automation-worker` масштабируется `docker compose up -d --scale
automation-worker=N` (нет `container_name`); многоворкерность безопасна (диспетчер — `FOR UPDATE SKIP
LOCKED`, исполнение — CAS-claim); реальный параллелизм по РАЗНЫМ аккаунтам (Python `account_lock`
сериализует один аккаунт). `--timeout=180` (> job comment 120, < `retry_after` 300).

**LLM-авто-генерация коммента — проверена живьём:** провайдер `openai/gpt-4o` (ключ владельца) →
`CommentActionPlugin.resolve` → `LlmService::generateComment(фото поста, caption)` сгенерил контекстный
коммент по фото (для lashes-поста — про ресницы) и опубликовал на живом аккаунте (`comment_pk`
подтверждён). `LlmSettingsController::store` теперь авто-делает первую настройку дефолтной (`getDefault()
=== null && setDefault(...)`) — иначе генерация не находила провайдера (этот пробел всплыл вживую).

**БЛОК «АВТОМАТИЗАЦИЯ» ПОЛНОСТЬЮ ЗАВЕРШЁН И ПРОВЕРЕН НА ЖИВОМ АККАУНТЕ.** Все 4 действия
(comment с LLM-авто-генерацией / like / follow / unfollow); полу-ручной + полностью-авто; парсинг
(хэштег/гео + `my_following`), фильтры, корзина; лимиты, рабочие часы (UI+enforcement), настройки;
очереди + диспетчер; cooldown, идемпотентность, realtime-прогресс, масштабирование воркеров.
