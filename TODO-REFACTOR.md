# TODO — Рефактор insta-pilot

> Единый список. Сведён из `REFACTOR_PLAN.md` (v2), старого `TODO-REFACTOR.md` и `TODO.md`.
> Каждый пункт **сверен с живым кодом 2026-06-20** (мульти-агентный аудит 31×: чтение кода +
> состязательная верификация, расхождений 0). Старый план был от 2026-04-03 и местами устарел.
>
> Учебный раздел «Пробелы в знаниях» из `TODO.md` сюда НЕ входит — он целиком в `TODO-LEARN.md`.
>
> Легенда статусов:
> ✅ **done/снято** — делать не нужно (сделано, устарело или премиса неверна)
> 🔴 **must** — корректность/безопасность/контракт
> 🟠 **should** — консистентность, hardening
> 🟢 **nice** — косметика/DRY, без функционального эффекта
> 🗓 **backlog** — отдельная осознанная волна, не в рамках рефактор-прохода

---

## Статус прохода (2026-06-20, ветка `refactor/todo-sweep`)

**Section 2 (актуальный рефактор) выполнен полностью** — 13 коммитов, распределённая сборка
(Kiro CLI: Opus/Sonnet/GLM + Codex дают черновики/применяют, интеграция и верификация — главной моделью):
M1, M3, M4, M5, M6, M7, M8, S1 (было done), S2, S3, S4, S5, S6, S7, S8, N1, N2, N3, N4, N5, N6, EXTRA.
Гейты зелёные: BE **231 passed**, FE **284 passed** (tsc/eslint чисто, кроме предсуществующей
`quasar.config.ts`), PY **165 passed**; smoke в Chrome — приложение грузится на чистом `/`, console чист.

**Осталось (backlog, отдельными волнами, см. §3):** M2 (proxy end-to-end), B1 (cookie-auth),
B3 (retry/backoff), B5 (eviction client cache), B7 (CRUD/product).

---

## 0. Сводная таблица

| ID | Тема | Статус | Объём | Параллельно? | Шов-файл |
|----|------|--------|-------|--------------|----------|
| M1 | Канал `comment-generation.{jobId}` открыт всем | 🔴 must | S | да | `routes/channels.php` |
| M3 | `findOrFail` в `ActivityLogController` ломает envelope | 🔴 must | S | да | — |
| M4 | axios редиректит на `/#/login` при history mode | 🔴 must | S | бандл auth | `boot/axios.ts` |
| EXTRA | 401 vs 422 при неверном пароле + хак `isAuthLogin` | 🔴 must | S | бандл auth | `boot/axios.ts` |
| —  | Двойная обработка 401 (interceptor + guard) | 🔴 must | S | бандл auth | `boot/axios.ts`, `guard.ts` |
| M5 | Reverb/Echo конфиг захардкожен | 🟠 should | S | да | `echo.ts` |
| M7 | `CLAUDE.md` расходится с кодом (3 таблицы) | 🔴 must | S | да | `CLAUDE.md` |
| M8 | Нет `python-service/.dockerignore` (venv 125M в образ) | 🔴 must | S | да | — |
| M6 | `getStatsByAccount()` — 7 SQL вместо 4 | 🟢 nice | S | да | — |
| S2 | `logBatch()` нет в интерфейсе `ActivityLogger` | 🟠 should | S | да | интерфейс |
| S3 | `/account/info` обещает поля, которых не отдаёт | 🟠 should | M | нет | `InstagramClientService.php`, py |
| S4 | Нет timeout у 6 Laravel→Python вызовов | 🟠 should | S | да | `InstagramClientService.php` |
| S5 | Дублированный try/except в FastAPI (11×) | 🟠 should | M | да | `main.py` |
| S6 | `CommentController` без `message` в 2 методах | 🟠 should | S | да | — |
| S7 | Прямые импорты мимо slice public API | 🟠 should | M | нет | барреллы entities |
| S8 | Прямой `q-toggle` вместо `ToggleComponent` | 🟠 should (частично) | S | да | — |
| N1 | Сломанный и мёртвый фасад `InstagramClient` | 🟢 nice → удалить | S | да | `config/app.php` |
| N2 | `sendComment` живёт в `searchStore` (перенести) | 🟢 nice (частично) | S | нет | `searchStore.ts`, `commentStore.ts` |
| N3 | 36× `.then(response => response.data)` | 🗓 backlog | S | нет | `shared/api` |
| N4 | 16× условный spread `...(x ? {x} : {})` | 🟢 nice | S | нет | `shared/lib` |
| N5 | 2× `print()` вместо `logging` в py | 🟢 nice | S | да | — |
| N6 | `RobotIcon` импортируется мимо barrel (+ `src/`→`@/`) | 🟢 nice (частично) | S | да | — |
| M2 | proxy не реализован end-to-end (мёртвая колонка) | 🗓 backlog | L | нет | py + Laravel цепочка |
| B1 | token в `localStorage` → cookie/Sanctum SPA | 🗓 backlog | L | нет | auth-флоу целиком |
| B3 | retry/backoff для read-only py (нужен design note) | 🗓 backlog | M | да | `client.py`, `utils.py` |
| B5 | client cache eviction по созданию, не last-access | 🗓 backlog | S | да | `client.py` |
| B7 | Недостающий CRUD/API (product, не рефактор) | 🗓 backlog | L | да | `routes/api.php` |
| S1 | `shared/ui` → `entities` (нарушение слоя) | ✅ done | — | — | — |
| B2 | Декомпозиция `python main.py` | ✅ снято (устарело) | — | — | — |
| B4 | Кэширование LLM-настроек | ✅ снято (нечего кэшировать) | — | — | — |
| B6 | Перенос `test_feed_pagination.py` | ✅ снято (это CLI, не тест) | — | — | — |
| B8 | Массовая миграция Quasar → wrapper | ✅ снято → сведено в S8 | — | — | — |

---

## 1. ✅ Снято — делать НЕ нужно (аудит подтвердил)

- **S1 — `shared/ui` → `entities`.** Уже исправлено: `MediaCard.vue`, `MediaDisplay.vue`,
  `useMediaStyle.ts` перенесены в `entities/media-post/ui/` (коммит `33aeff7`). В `shared/ui`
  media-папок нет, импортов `@/entities` из `shared/` — ноль.
- **B2 — декомпозиция `python main.py`.** Уже разбит на модули (`schemas`/`client`/`helpers`/
  `lock`/`utils`, коммит `7808b90`). `main.py` = 650 строк = тонкий слой из 12 эндпоинтов, на каждый
  модуль есть unit-тесты. Дальнейшее дробление на роутеры — необязательная косметика.
- **B4 — кэширование LLM-настроек.** Кэшировать нечего: `getDefault()` — один индексируемый SELECT
  один раз на async-джобу (рядом скачивание картинки 30с + вызов LLM 60с). Кэш дал бы только
  сложность инвалидации.
- **B6 — перенос `test_feed_pagination.py`.** Это argparse-CLI для ручной отладки, не pytest-тест
  (нет `def test_*`). `pytest.ini testpaths=tests` его не собирает. Перенос в `tests/` был бы вреден
  (top-level код исполнится при коллекции). Максимум — опционально переименовать без префикса `test_`.
- **B8 — массовая миграция Quasar.** Из 130+ прямых `q-*` обязательных нарушений всего 2 (есть
  обёртка, но взят сырой компонент): `q-toggle` (→ S8) и `q-badge` в `MainLayout.vue:70`. Остальное —
  presentation/layout/slot-примитивы без обёрток. Массовой волны нет — точечно через S8.
- **Подпункты, снятые внутри живых пунктов** (premise неверна): дедуп hashtag/location (N2 — это
  разные эндпоинты), `replied_to_comment_id` (N6 — живое поле), auto-cleanup в `useCommentGeneration`
  (N6 — cleanup намеренно вынесен наружу), `LlmSetting::setApiKeyAttribute(?string)` (N6 — уже
  non-nullable, поле обязательно), приведение `ModalComponent` к wrapper-паттерну (S8 — это композит,
  не proxy-wrapper), однобуквенный callback в `commentStore` (N6 — уже исправлен).

---

## 2. Актуальный рефактор

### 🔴 Волна A — безопасность и контракты

#### M1. Закрыть канал `comment-generation.{jobId}` `[S]`
`routes/channels.php:12-14` авторизует канал через `return true` (колбэк даже не принимает `$user`) —
любой залогиненный подпишется на чужой job. Ownership-модели нет: `jobId` — одноразовый `Str::uuid()`
(`CommentGenerateController.php:20`), нигде не привязан к user; `CommentGenerationProgress` не несёт
`userId`. Митигация: UUID неперечислим (нужна утечка чужого jobId), но дыра реальна.
**Решение:** при dispatch писать `jobId→userId` в Cache с TTL (≈5 мин) **синхронно в контроллере ДО
`return`** (иначе гонка с `/broadcasting/auth`), в канале сверять `$user->id`. Без новой таблицы.
Добавить Feature-тест на отказ чужому юзеру. Файлы: `channels.php`, `CommentGenerateController.php`.

#### M3. Единый JSON-envelope в `ActivityLogController` `[S]`
`index()` (стр.18) и `stats()` (стр.53) зовут `findOrFail()` → 404 рендерит фреймворк
(`{"message":...}`), мимо `{success,error,message}`. 403 в том же контроллере уже отдаётся envelope —
404 пробивает. Глобального API-render нет (`bootstrap/app.php withExceptions` пуст).
**Решение:** локально как в `AdminUserController`/`LlmSettingsController` — `find()` + при `null`
вернуть `response()->json(['success'=>false,'error'=>'Аккаунт не найден'],404)` в обоих методах +
тест на 404.

#### Бандл AUTH (делать вместе — все правят `boot/axios.ts`) `[S]`
Три связанных дефекта в auth-флоу фронта:
- **M4** — `axios.ts:25` при 401 делает `window.location.href = '/#/login'`, но включён history mode
  (`quasar.config.ts:51`, `createWebHistory`, чистые пути). `/#/login` ведёт на `/` с висящим
  фрагментом, а не на роут логина. Единственное hash-вхождение во всём `src`. → заменить на `'/login'`.
- **EXTRA (401 vs 422)** — `AuthController::login()` при неверном пароле отдаёт 401 (стр.42), что
  совпадает с 401 от Sanctum (протухший токен). Из-за этого в `axios.ts:22-23` костыль
  `isAuthLogin = url.includes('/auth/login')`. → вернуть **422** при неверных credentials, убрать
  `isAuthLogin`, оставить чистое `if (status === 401)`. **403 при деактивации (стр.54) не трогать.**
  (Пункта нет в `REFACTOR_PLAN.md` — только в `TODO.md`/старом `TODO-REFACTOR.md`.)
- **Двойная обработка 401** — interceptor (`window.location.href`) и catch в `guard.ts:20`
  (`clearAuth()` + redirect) срабатывают оба. → после M4/EXTRA свести к одному механизму.

**Тесты под правку:** `axios.spec.ts:56` (кейс «при 401 на /auth/login НЕ удаляет токен» — исчезает),
`AuthTest.php:92` `test_login_fails_with_wrong_password` (`assertStatus(401)` → `422`). `authStore`/
форма статус-код не парсят — правок не требуют.

#### M7. Синхронизировать `CLAUDE.md` с кодом `[S]` — ВАЖНО
Память проекта вводит в заблуждение. Дрейф по 3 таблицам (каналы — единственное, что совпадает):
- **`device_profiles`**: в `CLAUDE.md` — `name/manufacturer/model/android_version/app_version/
  user_agent`; в миграции — `code(unique)/title/device_settings(json)/user_agent/is_active`.
- **`account_activity_logs`**: в `CLAUDE.md` — 6 раздельных json-полей `vue_*/python_*/instagram_*`;
  в миграции+модели — `http_code/endpoint/request_payload(json)/response_summary(json)/error_code/
  duration_ms` + `user_id` FK, `$timestamps=false`.
- **`instagram_accounts`**: в `CLAUDE.md` заявлено `device_settings(json)` на аккаунте — его нет
  (есть `device_model_name` string + `device_profile_id` FK); не отражён `user_id` FK.
- **FE-блок «Паттерн activity-log-table»**: реально рисуется **4** секции (добавилась LLM API), а в
  `CLAUDE.md` описаны 3. (Трёх-«трубная» проекция двух json-полей — корректна, это не дрейф.)

#### M8. `python-service/.dockerignore` `[S]`
Файла нет; `docker-compose.yml:50` собирает с `context: ./python-service`, `Dockerfile` — `COPY . .`
→ в контекст и образ уходит `venv/` (**125M из 126M**). `.gitignore` на docker build context не
действует. **Решение:** создать `.dockerignore` (минимум — `venv/`, плюс `__pycache__/`, `*.pyc`,
`.pytest_cache/`, `.DS_Store`, `tests/`, `test_*.py`, `requirements-dev.txt`, `pytest.ini`, `Makefile`).

#### M5. Reverb/Echo конфиг env-driven `[S]` (🟠 по сути)
`echo.ts:17-18` — `forceTLS:false` и `enabledTransports:['ws']` захардкожены; `VITE_REVERB_SCHEME`
из `.env` нигде не читается и не типизирован в `env.d.ts`; в `.env.example` Reverb-переменных нет.
Живого бага нет (локально `scheme=http`), но переменная мёртвая и путь к `wss` не работает.
**Решение:** `forceTLS: scheme === 'https'`, транспорт по схеме; добавить `VITE_REVERB_SCHEME` в
`env.d.ts` и блок Reverb-переменных в `.env.example`.

### 🟠 Волна B — стабильность backend/python

#### S2. Добавить `logBatch()` в `ActivityLoggerServiceInterface` `[S]`
`logBatch()` есть в реализации (стр.53-73), в интерфейсе — только `log()`. Продакшен-вызовов
`logBatch` нет (есть только тест на конкретном классе). **Решение:** добавить сигнатуру в интерфейс
(с PHPDoc по форме `$entries`) — либо удалить метод+тест как мёртвый код, если пакетная запись не нужна.

#### S3. Честный контракт `/account/info` `[M]`
Схема обещает `followers_count`/`following_count` (`schemas.py:36-37`), docstring тоже, но эндпоинт
заполняет только `user_pk` — оба поля всегда `None` (структурно: `cl.account_info()` → тип `Account`
без этих полей; они есть у `User` через `cl.user_info()`). Мёртво end-to-end до UI (`'—'`).
**Решение (рекомендуется A):** удалить поля из схемы и всех потребителей (Laravel
`InstagramClientService:85-90`, `InstagramAccountController:101-102,108-109`, FE `apiTypes`/DTO/
`ViewInstagramAccountModal`). Вариант B (заполнить через доп. `user_info`) дороже и противоречит
позиционированию эндпоинта как лёгкой проверки сессии. Зафиксировать контракт ассертом в тесте.

#### S4. Timeout для 6 Laravel→Python вызовов `[S]`
`partial`: 5 методов timeout уже имеют, но `login/getUserInfo/getUserInfoByPk/addLike/
searchLocations/commentMedia` идут через голый `Http::post` без `->timeout()`. Глобального дефолта
нет → зависший Python заблокирует PHP-воркер. **Решение:** единый источник вместо магических чисел —
константа/хелпер класса или `Http::globalOptions(['timeout'=>...])` в `AppServiceProvider::boot()`
с override для `getFeed`. Заодно выровнять разнобой значений (15/20/30/60). Учесть: PHP-таймаут даст
Guzzle-исключение, которого в этих методах сейчас не ловят (нет try/catch).

#### S5. Централизовать ошибки FastAPI `[M]`
11 эндпоинтов повторяют один `except Exception` + `error_to_code/error_to_http_status`; 2
(`/media/comments[/replies]`) строят dict вручную. **Решение:** `@app.exception_handler` в `main.py`,
тело `{success:false,error:str(exc),error_code}` + статус из `error_to_http_status` (контракт с
Laravel сохраняется). Из эндпоинтов убрать try/except, `_run()` оставляет только success-ветку.
Нюанс: 9 `_run()` внутри `async with account_lock(...)` — проверить освобождение lock при пробросе.

#### S6. `CommentController` — единый success-envelope `[S]`
`index()` (стр.46) и `replies()` (стр.79) возвращают success без `message`; `store()` — с `message`.
Это единственные два success-ответа во всём бэкенде без `message`. **Решение:** добавить
`'message'=>'OK'` (или осмысленный текст). Тесты `message` не ассертят.

#### M6. Оптимизировать `getStatsByAccount()` `[S]` (🟢 низкий приоритет)
7 SQL на аккаунт. 4 скалярных (`total/today/successCount/avgDuration`) сливаются в один `selectRaw`
(паттерн уже есть в `getSummary`). `by_action/by_status/last_error` оставить (другая кардинальность).
Shape ответа не меняется. **Нюанс:** не копировать из `getSummary` Postgres-специфичный
`created_at::date = current_date` — для sqlite-тестов «сегодня» делать через диапазон по `created_at`.

### 🟠🟢 Волна C — frontend cleanup

#### S7. Импорты через slice public API `[M]`
Нарушения: (1) страницы/фичи тянут из `entities/.../model/*` полным путём, хотя символы есть в
barrel; (2) `AccountSelectComponent.vue` импортируется напрямую — его нет в
`instagram-account/index.ts`; (3) `AdminUsersPage` тянет `adminUsersTableColumns`/`adminUsersListDTO`
из `user/model/*` — их нет в `user/index.ts`. **Решение:** (A, последовательно) расширить барреллы;
(B) переписать потребителей на `@/entities/<slice>`. Внутрислайсовые полнопутёвые импорты НЕ трогать.
Опционально: закрепить ESLint-правилом boundaries. (LoginPage чист.)

#### S8. `q-toggle` → `ToggleComponent` `[S]`
`partial`: реальна только toggle-часть — `InstagramAccountsPage.vue:73` (последний прямой `q-toggle`
вне обёрток). **Решение:** заменить на `ToggleComponent` (`label`/`dense` поддерживаются) + импорт.
`ModalComponent` НЕ трогать (композит, не proxy-wrapper). Заодно сюда же — `q-badge` →
`BadgeComponent` в `MainLayout.vue:70` (из снятого B8). Можно закрепить ESLint `no-restricted-syntax`.

#### N1. Удалить мёртвый фасад `InstagramClient` `[S]`
`getFacadeAccessor()` возвращает `'InstagramClient'`, а binding — по `...Interface::class`: фасад
упал бы `BindingResolutionException`. Реальных вызовов нет (везде конструкторный DI).
**Решение:** удалить `Facades/InstagramClient.php`, строку алиаса в `config/app.php:135` и `use`
вверху `config/app.php`. (Чинить незачем — DI уже единый рабочий путь.)

#### N2. Перенести `sendComment` в `commentStore` `[S]`
`partial`: `sendComment` живёт в `searchStore` (поиск), оторван от чтения комментариев в
`commentStore`; единственный потребитель `PostDetailModal.vue` уже инжектит `commentStore`.
**Решение:** перенести `sendComment`/`sendCommentApi`/`sendCommentLoading` в `commentStore`, поправить
`PostDetailModal.vue` (стр.64,209) и перенести тест-кейсы. Часть про дедуп hashtag/location — не делать.

#### N4. Хелпер `compactParams` для условных spread `[S]`
16× `...(x ? {x} : {})` в 4 сторах (`feedStore` 9, `searchStore` 4, `activityLogStore` 2,
`commentStore` 1). В `feedStore` дублируется в params фабрики и на call-site. **Решение:** один
pure-хелпер в `shared/lib` + замена. **Важно:** фильтровать именно **falsy** (не nullish) — текущие
проверки truthy; иначе поведение разойдётся при валидном `0`/`''`.

#### N5. `print()` → `logging` (py) `[S]`
2 отладочных `print(f"[FEED] ...")`: `main.py:237`, `helpers.py:321` (на каждый `/account/feed`).
`logging` в этих файлах не импортирован. **Решение:** `logging.getLogger(__name__)` + `logger.debug`,
централизованная инициализация в точке входа (сервис `--workers 1`). `test_feed_pagination.py` не трогать.

#### N6. `RobotIcon` через barrel `[S]`
Реален только этот подпункт: `MainLayout.vue:11` (`src/...RobotIcon.vue`, ещё и алиас `src/` вместо
`@/`) и `LoginPage.vue:4` импортируют `RobotIcon` мимо barrel `@/shared/ui/icons`.
**Решение:** импортировать из `@/shared/ui/icons`, в `MainLayout.vue` заменить `src/`→`@/`.
Остальные 4 подпункта сняты (см. раздел 1).

#### N3. Хелпер для `response.data` `[S]` (🗓 backlog по приоритету)
36× `.then((response) => response.data)` в 8 сторах (interceptor `.data` не распаковывает, обёртка
обязательна). **Решение:** тонкий типобезопасный `apiData<T>`/`apiClient` в `shared/api` + sweep.
Альтернатива через success-interceptor ломает типизацию axios — не делать. Чистая косметика, низкий
приоритет — делать одной волной, не разбрасывать.

---

## 3. 🗓 Backlog — отдельные осознанные волны (не в рамках рефактор-прохода)

- **M2 — proxy end-to-end `[L]`.** Не «проброс значения», а **фича не реализована**: колонка `proxy`
  мёртвая (нет в `$fillable`, без accessor/mutator), `set_proxy` не зовётся нигде, схемы Python без
  `proxy`. Объём: py-схемы + `set_proxy` в login и `_make_client`, расширение сигнатур
  `InstagramClientService`, форма/модель/DTO + **шифрование proxy** (как `session_data`) и исключение
  из activity-log. По `CLAUDE.md`: прокси задавать до авторизации, валидировать формат заранее.
- **B1 — token из `localStorage` → cookie/Sanctum SPA `[L]`.** Подтверждено во всех 4 точках
  (`authStore`/`axios`/`guard`/`echo`); бэк на personal access tokens, stateful-режим не включён.
  Full-stack security-инициатива (CSRF-cookie, `withCredentials`, `EnsureFrontendRequestsAreStateful`,
  CORS, переписать broadcasting/auth и тесты, включая `e2e/auth.spec.ts`). Учесть cross-site (порты
  9000/8000).
- **B3 — retry/backoff для read-only py `[M]`.** Ретраев нет; rate-limit → немедленный 429. Делать
  **только по design note** (слепой retry ухудшает anti-bot). Дешёвый штатный вариант — выставить
  `cl.delay_range` в `_make_client` (сейчас не выставляется, встроенный троттлинг instagrapi спит) и
  распространить паузу на sections-пагинацию (есть только в ленте).
- **B5 — eviction client cache по last-access `[S]`.** Сейчас TTL/вытеснение по времени **создания**
  (на hit timestamp не обновляется) → активный клиент пересоздаётся каждые 300с. Комментарий «LRU by
  creation time» вводит в заблуждение. **Решение:** touch на hit (или `OrderedDict`). Импакт низкий
  (`MAX=20`=числу аккаунтов, size-eviction почти не наступает). Тесты завязаны на creation-time —
  переписать.
- **B7 — недостающий CRUD/API `[L]` (product, не рефактор).** Нет редактирования аккаунтов (нет
  `update`/PUT-PATCH), нет CRUD `device_profiles` (только read-only листинг; данные из JSON-сида),
  нет отдельных admin-маршрутов для activity (admin сейчас инлайн через `hasRole`). Делать по
  бизнес-потребности.

---

## 4. План параллельного выполнения

Рефактор **не** льётся одной «фабрикой» как дашборды: многие пункты правят общие файлы. Группы ниже
учитывают контеншн по шов-файлам (внутри группы — параллельно в worktree, между группами/внутри
«серий» — последовательно).

**Группа P1 — полностью параллельно (разные изолированные файлы):**
`M1` (channels), `M3` (ActivityLogController), `M6` (ActivityLogRepository), `S2` (interface),
`S6` (CommentController), `M7` (CLAUDE.md), `M8` (новый .dockerignore), `N1` (facade+config/app.php),
`M5` (echo.ts). Девять независимых единиц — годятся для fan-out субагентами.

**Серии (один файл — один исполнитель, последовательно внутри серии):**
- `boot/axios.ts`: **бандл AUTH** (M4 + EXTRA + двойной 401) — один заход.
- `InstagramClientService.php`: `S3` → `S4` (или один агент на оба).
- `python main.py`: `S5` → `N5` (или один агент).

**Группа P2 — frontend cleanup (после/независимо, разные слайсы):**
`S7` (барреллы — последовательно: сначала barrel, потом потребители), `S8`+`q-badge`, `N2`, `N4`,
`N6`, `N3`. `S7` и `N6` оба слегка трогают `MainLayout.vue` — не отдавать одновременно.

**Как запускать (см. `ORCHESTRATION.md` / `AGENT-FACTORY.md`):**
- Группа P1 — fan-out обычными субагентами с `isolation: worktree`, по одному пункту на агента, затем
  merge по ветке. Шов-файлы (`channels.php`, `config/app.php`, `AppServiceProvider.php`) сводит
  оркестратор после слияния.
- Серии и P2 — последовательно либо по одному агенту на файл.
- В ultracode-режиме аудит/ревью каждого мерджа можно прогнать через Workflow.

---

## 5. Проверка после реализации

**Frontend:** `docker compose exec vue npx eslint --fix ./src` → `... npx vue-tsc --noEmit` →
unit `... npx vitest run`. Ручное: редирект логина в history mode; live-activity по реальным каналам;
подписка на чужой comment-job отклоняется.
**Backend:** `docker compose exec laravel php artisan test`. Ручное: `ActivityLogController` отдаёт
envelope на 404; `CommentController` success-ответы консистентны; неверный пароль → 422; shape stats
не изменился.
**Python:** `docker compose exec python pytest`. Ручное: generic-исключения не раскрывают internal
details; login/feed/comment работают после централизации ошибок.
