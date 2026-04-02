# insta-pilot — Refactor Plan v2

> Ревизия исходного плана после повторной сверки с кодом.
> Этот документ оставляет в основном roadmap только подтвержденные и исполнимые задачи.
> Спорные микро-cleanup, product backlog и крупные redesign-задачи вынесены ниже отдельно.

Дата ревизии: 2026-04-03

---

## 0. Как использовать этот документ

- Этот план предназначен для последующей пошаговой реализации без расширения scope.
- В main roadmap входят только реальные дефекты, contract mismatch, hardening и архитектурные нарушения, подтвержденные по коду.
- Массовые stylistic cleanup и product-функции не должны смешиваться с первыми фазами.
- Если задача меняет auth-модель, WebSocket security-модель или контракт Laravel ↔ Python, её нужно реализовывать отдельным осознанным пакетом, а не "по пути".

---

## 1. Что исправлено в самом плане

Ниже перечислены правки относительно первой версии `REFACTOR_PLAN.md`.

### 1.1. Убраны или понижены ложные блокеры

- Пункт про отсутствие канала `private:activity-log` убран из критических багов.
  Реальный код использует `account-activity.{accountId}` и `activity-global.{userId}`:
  - `backend-laravel/app/Events/ActivityLogCreated.php`
  - `backend-laravel/routes/channels.php`
  - `frontend-vue/src/features/activity-live/lib/useActivityLive.ts`
  - `frontend-vue/src/features/activity-live/lib/useGlobalActivityLive.ts`
  Это не backend-баг, а drift документации в `CLAUDE.md`.

- Пункт про `python-service/helpers.py` с `raw["replied_to_comment_id"]` понижен до optional cleanup.
  Текущее выражение защищено через `raw.get(...)` в условии и не является подтвержденным crash bug.

- Поломанный фасад `InstagramClient` оставлен в плане, но понижен с critical до low-value cleanup.
  В проекте нет реальных вызовов `InstagramClient::...`, то есть проблема есть в коде, но не ломает текущий поток.

- Пункт про auto-cleanup в `useCommentGeneration` понижен.
  Сам composable не делает `onBeforeUnmount`, но текущий основной consumer уже вызывает `cleanup()`:
  - `frontend-vue/src/features/post-detail/ui/PostDetailModal.vue:98`
  - `frontend-vue/src/features/post-detail/ui/PostDetailModal.vue:105`

### 1.2. Уточнены неточные формулировки

- `findOrFail` в `ActivityLogController` больше не описывается как гарантированный HTML-ответ.
  Правильная формулировка: контроллер сейчас полагается на framework-level rendering и не гарантирует единый project envelope для not-found.

- Пункт про WebSocket TLS уточнен.
  Токен сейчас уходит через `authEndpoint`, а не внутри самого ws payload:
  - `frontend-vue/src/shared/lib/echo.ts`
  Проблема все равно остается: схема, TLS, transport и env-параметры захардкожены не для production.

- Путь к composable исправлен:
  - правильно: `frontend-vue/src/features/generate-comment/lib/useCommentGeneration.ts`
  - не `model/useCommentGeneration.ts`

- Подсчеты по frontend подтверждены повторно:
  - `.then((response) => response.data)` — `36` вхождений
  - `...(x ? { x } : {})` — `16` вхождений

### 1.3. Добавлены упущенные зависимости

- В security-пункт про token storage добавлен `frontend-vue/src/router/index.ts`, где guard тоже зависит от `localStorage`.
- В frontend public API cleanup добавлены прямые импорты UI-файлов:
  - `frontend-vue/src/pages/feed/ui/FeedPage.vue`
  - `frontend-vue/src/pages/search/ui/SearchPage.vue`
  - `frontend-vue/src/pages/login/ui/LoginPage.vue`
  - `frontend-vue/src/layouts/MainLayout.vue`
- Для Docker hardening уточнено, что `.dockerignore` нужен именно в `python-service/`, потому что build context в `docker-compose.yml` задан как `./python-service`.

---

## 2. Main Roadmap

В этом разделе остаются только задачи, которые имеет смысл отдавать следующему агенту как основной рабочий список.

### 2.1. Must Fix

Это задачи, которые реально влияют на корректность, безопасность контракта или стабильность текущего приложения.

#### M1. Закрыть доступ к каналу `comment-generation.{jobId}`

Сейчас любой авторизованный пользователь может подписаться на чужой job:
- `backend-laravel/routes/channels.php:12`

Задача:
- убрать `return true`
- ввести реальную модель владения job
- выбрать безопасный способ авторизации канала

Важно:
- не фиксировать решение заранее только через БД, потому что `jobId` сейчас не хранится как сущность
- допустимы варианты через отдельное хранилище ownership, signed token, transient mapping или другой явный механизм

Затронутые файлы:
- `backend-laravel/routes/channels.php`
- `backend-laravel/app/Http/Controllers/CommentGenerateController.php`
- `backend-laravel/app/Events/CommentGenerationProgress.php`
- `frontend-vue/src/features/generate-comment/lib/useCommentGeneration.ts`

#### M2. Довести поддержку proxy до рабочего end-to-end контракта

Поле proxy существует в данных аккаунта, но фактически нигде не проходит через Laravel → Python → instagrapi.

Что подтверждено:
- в Python login-схеме proxy отсутствует: `python-service/schemas.py`
- в Python login-flow proxy не применяется: `python-service/main.py`
- при восстановлении клиента proxy не применяется: `python-service/client.py`
- в Laravel login-flow proxy тоже не участвует: `backend-laravel/app/Http/Controllers/InstagramAccountController.php`

Задача:
- определить единый контракт proxy для добавления аккаунта
- валидировать proxy на Laravel-стороне
- передавать proxy в Python
- применять proxy до логина и до использования session-based клиента

Затронутые файлы:
- `backend-laravel/app/Http/Controllers/InstagramAccountController.php`
- `backend-laravel/app/Services/InstagramClientService.php`
- `python-service/schemas.py`
- `python-service/main.py`
- `python-service/client.py`

#### M3. Зафиксировать единый JSON-envelope для activity endpoints

Сейчас `ActivityLogController` использует `findOrFail()`:
- `backend-laravel/app/Http/Controllers/ActivityLogController.php:18`
- `backend-laravel/app/Http/Controllers/ActivityLogController.php:53`

Проблема не в самом `findOrFail`, а в том, что error-flow зависит от framework default rendering, а не от project-level API envelope.

Задача:
- гарантировать стабильный JSON-ответ для not-found и аналогичных ошибок
- не допускать выхода из стандартного формата `success/error/message`

Допустимые пути:
- локально в контроллере
- либо через централизованный exception rendering

Затронутые файлы:
- `backend-laravel/app/Http/Controllers/ActivityLogController.php`
- опционально `backend-laravel/bootstrap/app.php`

#### M4. Исправить redirect при `401` под `history` mode

Во frontend уже включен `history` mode:
- `frontend-vue/quasar.config.ts:51`

Но `axios` редиректит на hash-route:
- `frontend-vue/src/boot/axios.ts:25`

Задача:
- убрать хардкод `/#/login`
- привести поведение `axios` interceptor и router guard к одной схеме

Затронутые файлы:
- `frontend-vue/src/boot/axios.ts`
- `frontend-vue/src/router/index.ts`

#### M5. Привести Reverb/Echo конфиг к безопасному конфигурируемому виду

Что подтверждено:
- `forceTLS: false` захардкожен: `frontend-vue/src/shared/lib/echo.ts:17`
- transport захардкожен в `['ws']`: `frontend-vue/src/shared/lib/echo.ts:18`
- `VITE_REVERB_SCHEME` есть в `.env`, но не используется: `frontend-vue/.env`
- `VITE_REVERB_SCHEME` не типизирован: `frontend-vue/src/env.d.ts`
- Reverb-переменные отсутствуют в `frontend-vue/.env.example`

Задача:
- вынести scheme/TLS/transport в env-driven конфиг
- не ломать local dev
- сделать production-ready путь для `wss`

Затронутые файлы:
- `frontend-vue/src/shared/lib/echo.ts`
- `frontend-vue/src/env.d.ts`
- `frontend-vue/.env.example`

#### M6. Оптимизировать `getStatsByAccount()`

Подтверждено, что метод строит статистику через серию отдельных запросов:
- `backend-laravel/app/Repositories/ActivityLogRepository.php:92`

Задача:
- сократить число SQL-запросов без изменения внешнего ответа
- сохранить текущую shape-структуру stats payload

Затронутые файлы:
- `backend-laravel/app/Repositories/ActivityLogRepository.php`

#### M7. Синхронизировать `CLAUDE.md` с реальным проектом

Drift уже мешает ревью и следующей автоматизации.

Что точно не совпадает:
- каналы activity events
- структура `device_profiles`
- структура `account_activity_logs`
- поля `instagram_accounts` вокруг device profile/device model

Затронутые файлы:
- `CLAUDE.md`

#### M8. Добавить `python-service/.dockerignore`

Сейчас Python image собирается из контекста `./python-service`:
- `docker-compose.yml:49`

При отсутствии `.dockerignore` в образ попадает лишнее, включая `venv/`.

Задача:
- добавить минимальный `.dockerignore` для Python build context

Затронутые файлы:
- `python-service/.dockerignore`

---

### 2.2. Should Fix

Это задачи, которые желательно выполнить в той же волне, но только после Must Fix.

#### S1. Убрать зависимость `shared/ui` от `entities`

Подтвержденное нарушение слоя:
- `frontend-vue/src/shared/ui/media-card/MediaCard.vue`
- `frontend-vue/src/shared/ui/media-display/MediaDisplay.vue`
- `frontend-vue/src/shared/ui/media-display/useMediaStyle.ts`

Допустимы два пути:
- перенести media-specific UI в `entities/media-post/ui/`
- либо опустить используемые типы/константы ниже, если компонент действительно должен остаться `shared`

Предпочтительный путь для текущего проекта:
- перенос в `entities/media-post/ui/`, так как оба компонента жестко связаны с `MediaPost` и `MEDIA_TYPE`

#### S2. Синхронизировать `ActivityLoggerServiceInterface` и реализацию

Подтверждено:
- `logBatch()` есть в `backend-laravel/app/Services/ActivityLoggerService.php`
- метода нет в `backend-laravel/app/Services/ActivityLoggerServiceInterface.php`

Задача:
- либо добавить `logBatch()` в интерфейс
- либо убрать его из публичного контракта, если это сознательно internal helper

#### S3. Привести `/account/info` к честному контракту

Сейчас схема обещает `followers_count` и `following_count`, но endpoint их не возвращает:
- `python-service/schemas.py`
- `python-service/main.py:154`
- `backend-laravel/app/Services/InstagramClientService.php:84`

Задача:
- либо реально заполнить эти поля
- либо убрать их из схемы и потребителей

#### S4. Добавить явные timeout для всех Laravel → Python вызовов

Подтверждено, что без timeout остаются методы:
- `login()`
- `getUserInfo()`
- `getUserInfoByPk()`
- `addLike()`
- `searchLocations()`
- `commentMedia()`

Затронутый файл:
- `backend-laravel/app/Services/InstagramClientService.php`

#### S5. Централизовать неожиданные ошибки в FastAPI

Сейчас каждый endpoint повторяет однотипный `try/except`, а generic errors отдаются через `str(e)`.

Задача:
- сохранить текущий exception mapping для известных Instagram/network ошибок
- централизовать обработку неожиданных исключений
- не отдавать наружу избыточные internal details

Затронутые файлы:
- `python-service/main.py`
- `python-service/utils.py`

#### S6. Привести `CommentController` к единому success-envelope

Подтверждено:
- `index()` и `replies()` возвращают success-ответ без `message`
- `store()` уже возвращает `message`

Затронутый файл:
- `backend-laravel/app/Http/Controllers/CommentController.php`

#### S7. Почистить frontend public API usage

Задача состоит не в массовом stylistic cleanup, а в соблюдении уже принятого slice public API.

Подтверждено:
- часть файлов импортирует напрямую из `model/`
- есть прямые импорты UI-файлов мимо slice API

Минимальный обязательный набор:
- использовать entity barrel там, где он уже достаточен
- дополнить barrel только реально нужными экспортами
- убрать прямые импорты файлов `*.vue`, где есть нормальный public entry

Особенно важно проверить:
- `frontend-vue/src/pages/feed/ui/FeedPage.vue`
- `frontend-vue/src/pages/search/ui/SearchPage.vue`
- `frontend-vue/src/pages/instagram-accounts/ui/InstagramAccountsPage.vue`
- `frontend-vue/src/pages/admin-users/ui/AdminUsersPage.vue`
- `frontend-vue/src/entities/user/index.ts`
- `frontend-vue/src/layouts/MainLayout.vue`
- `frontend-vue/src/pages/login/ui/LoginPage.vue`

#### S8. Уточнить политику wrapper-компонентов и исправить только подтвержденные исключения

Не нужно запускать массовую миграцию всех прямых Quasar-компонентов.

Что стоит исправить точно:
- `q-toggle` в `frontend-vue/src/pages/instagram-accounts/ui/InstagramAccountsPage.vue:73`
- `ModalComponent`, потому что он реально выбивается из принятой обертки и усложняет консистентность

Что не нужно делать автоматически в первой волне:
- переписывать все `q-icon`, `q-avatar`, `q-spinner`, `q-skeleton`

---

### 2.3. Nice to Have

Эти задачи имеют смысл только после закрытия Must/Should или если затрагиваемые файлы все равно открываются.

#### N1. Починить или удалить неиспользуемый фасад `InstagramClient`

Подтверждено:
- accessor сломан: `backend-laravel/app/Facades/InstagramClient.php`
- реальных вызовов фасада в проекте нет

Рекомендация:
- либо исправить accessor
- либо удалить фасад как мертвый слой абстракции

#### N2. Упростить `searchStore`

Подтверждено:
- `sendComment` живет в `searchStore`
- логика hashtag/location частично дублируется

Затронутые файлы:
- `frontend-vue/src/entities/media-post/model/searchStore.ts`
- `frontend-vue/src/entities/media-post/model/commentStore.ts`

#### N3. Вынести helper для `response.data`

Подтверждено:
- `36` повторов `.then((response) => response.data)`

Это хороший cleanup, но не must-fix.

#### N4. Упростить условные spreads

Подтверждено:
- `16` повторов `...(x ? { x } : {})`

Это stylistic cleanup, не производительность и не баг.

#### N5. Заменить `print()` на `logging`

Подтверждено:
- `python-service/main.py:237`
- `python-service/helpers.py:318`

Это observability cleanup, не security task.

#### N6. Небольшие low-value cleanup только если файлы уже трогаются

- `replied_to_comment_id` в `python-service/helpers.py`
- однобуквенный callback в `frontend-vue/src/entities/media-post/model/commentStore.ts`
- прямой импорт `RobotIcon` в layout/login
- `useCommentGeneration` internal auto-cleanup
- `LlmSetting::setApiKeyAttribute(?string)` только если реально меняется lifecycle `api_key`

---

## 3. Backlog / вне первой волны

Это не нужно смешивать с ближайшим рефакторингом.

### B1. Миграция auth-модели на cookie-based auth / Sanctum SPA mode

Проблема с token в `localStorage` подтверждена, но это не локальный frontend refactor, а отдельная full-stack security initiative.

Затронутые зоны:
- `frontend-vue/src/entities/user/model/authStore.ts`
- `frontend-vue/src/boot/axios.ts`
- `frontend-vue/src/router/index.ts`
- `frontend-vue/src/shared/lib/echo.ts`
- backend auth flow / sanctum config

### B2. Декомпозиция `python-service/main.py`

Файл большой, но это архитектурная работа, а не defect fix.

### B3. Retry/backoff для Python read-only сценариев

Добавлять только после явного design note, чтобы не усиливать anti-bot риски.

### B4. Кэширование LLM-настроек

Потенциально полезно, но без профилирования это backlog-оптимизация.

### B5. Пересмотр eviction-стратегии client cache в Python

Сейчас стратегия основана на времени создания записи, а не на last-access.
Это полезный hardening, но не ранняя задача.

### B6. Перенос `test_feed_pagination.py`

Файл не мешает `pytest`, потому что `python-service/pytest.ini` ограничивает testpaths директорией `tests`.

### B7. Недостающие CRUD/API-возможности

Не считать это рефакторингом по умолчанию:
- редактирование аккаунтов
- CRUD для `device_profiles`
- дополнительные admin endpoints для activity logs

Это product scope, не cleanup.

### B8. Массовая миграция прямых Quasar-компонентов в wrapper-ы

Делать только после формализации политики: какие компоненты обязаны идти через wrapper, а какие допустимы как presentation-only.

---

## 4. Предлагаемый порядок реализации

### Волна A — контракт и безопасность

1. `M1` канал `comment-generation.{jobId}`
2. `M2` proxy end-to-end
3. `M3` единый JSON-envelope для activity endpoints
4. `M5` Reverb/Echo config
5. `M4` redirect в `history` mode

### Волна B — стабильность backend/python

1. `M6` оптимизация `getStatsByAccount()`
2. `S2` синхронизация `ActivityLoggerServiceInterface`
3. `S3` честный контракт `/account/info`
4. `S4` явные timeout
5. `S5` централизованный FastAPI error handling
6. `S6` единый success-envelope в `CommentController`

### Волна C — frontend architecture cleanup

1. `S1` убрать `shared -> entities`
2. `S7` frontend public API cleanup
3. `S8` wrapper policy + точечные исправления
4. `N2` cleanup `searchStore`
5. `N3`/`N4` low-risk simplification

### Волна D — docs and infra

1. `M7` синхронизация `CLAUDE.md`
2. `M8` `python-service/.dockerignore`
3. backlog items только по отдельному решению

---

## 5. Что не делать в первой реализации

- Не переводить весь проект на cookie-auth без отдельной задачи.
- Не разбивать Python-сервис на пакеты в той же ветке, где чинятся контракты и WebSocket security.
- Не переписывать массово все Quasar-компоненты в wrapper-ы.
- Не тащить в main roadmap мелкие stylistic правки без поведенческой ценности.
- Не менять публичные API ради красоты без явной пользы.

---

## 6. Проверка после реализации

### Frontend

- `docker compose exec vue npx eslint --fix ./src`
- `docker compose exec vue npx vue-tsc --noEmit`

Ручная проверка:
- неавторизованный редирект работает в `history` mode
- live updates activity работают через реальные каналы `account-activity.*` и `activity-global.*`
- comment generation subscription не открывается постороннему пользователю
- Reverb/Echo работает с конфигом из env

### Backend Laravel

- `docker compose exec laravel php artisan test`

Ручная проверка:
- `ActivityLogController` всегда отдает ожидаемый JSON-format на not-found/error-path
- `CommentController` success-ответы консистентны
- stats payload не изменился по shape после оптимизации

### Python

- `docker compose exec python pytest`

Ручная проверка:
- login/account info/search/comment работают после добавления proxy-пути
- generic exceptions не раскрывают лишние internal details
- proxy применяется до логина и при session-based клиенте

---

## 7. Краткий итог

Текущий рабочий фокус для следующего агента:

1. Закрыть реальный security gap в `comment-generation.{jobId}`.
2. Довести proxy до рабочего контракта Laravel ↔ Python ↔ instagrapi.
3. Починить frontend auth/reverb path под текущий `history` mode и env-driven transport config.
4. Убрать подтвержденное FSD/public API drift во frontend.
5. Синхронизировать документацию с реальным кодом, чтобы следующий цикл автоматизации опирался на правду, а не на устаревшие описания.

Все остальное стоит делать только после закрытия этих пяти блоков.
