# План аудита фронтенд-тестов — insta-pilot

## Обзор текущего состояния

| Уровень | Фреймворк | Кол-во файлов | Расположение |
|---------|-----------|---------------|-------------|
| Unit | Vitest + @vue/test-utils + happy-dom | 34 | `src/**/__tests__/*.spec.ts` |
| Integration | Vitest (environment: node) | 1 | `tests/integration/api.spec.ts` |
| E2E | Playwright (Chromium, headless) | 8 | `e2e/*.spec.ts` |
| **Итого** | | **43** | |

---

## Раздел 1. Аудит unit-тестов (34 файла)

### 1.1 DTO-тесты (8 файлов)

| # | Файл | Строк | Что проверить |
|---|------|-------|---------------|
| 1 | `entities/activity-log/model/__tests__/activityLogDTO.spec.ts` | 161 | Полноту маппинга snake_case → camelCase; обработку nullable-полей; edge cases (пустые массивы, null) |
| 2 | `entities/instagram-account/model/__tests__/instagramAccountDTO.spec.ts` | 104 | Маппинг зашифрованных полей; proxy для profile_pic_url; device_profile маппинг |
| 3 | `entities/instagram-account/model/__tests__/instagramAccountListDTO.spec.ts` | 41 | Маппинг массива аккаунтов; RowModel-совместимость с TableColumns |
| 4 | `entities/llm-settings/model/__tests__/llmSettingsDTO.spec.ts` | 68 | Маппинг api_key (hidden); булевы поля (is_default, use_caption) |
| 5 | `entities/media-post/model/__tests__/mediaPostDTO.spec.ts` | 184 | Все типы медиа (photo/video/carousel); resources маппинг; edge cases carousel с 0 items |
| 6 | `entities/user/model/__tests__/adminUsersListDTO.spec.ts` | 55 | Маппинг ролей (admin/user); RowModel-совместимость |
| 7 | `widgets/activity-log-table/lib/__tests__/responseFormatters.spec.ts` | 80 | Форматирование request/response для expanded-строки; preview-данные |

**Чек-лист для каждого DTO-теста:**
- [ ] Все поля API-типа покрыты (сравнить с `apiTypes.ts`)
- [ ] Nullable-поля тестируются со значением `null`
- [ ] Пустой массив на входе возвращает пустой массив
- [ ] Некорректные/неожиданные данные не вызывают runtime-ошибку
- [ ] Тип возвращаемого значения соответствует `types.ts`
- [ ] Нет дублирования логики между тестами DTO и тестами store

---

### 1.2 Pinia Store-тесты (9 файлов)

| # | Файл | Строк | Что проверить |
|---|------|-------|---------------|
| 1 | `entities/activity-log/model/__tests__/activityLogStore.spec.ts` | 218 | fetchLogs, фильтрация, пагинация, очистка |
| 2 | `entities/activity-log/model/__tests__/sidebarActivityStore.spec.ts` | 108 | Открытие/закрытие sidebar, выбранная запись |
| 3 | `entities/instagram-account/model/__tests__/accountStore.spec.ts` | 169 | CRUD аккаунтов, updateActive toggle |
| 4 | `entities/llm-settings/model/__tests__/llmSettingsStore.spec.ts` | 161 | CRUD LLM-настроек, setDefault |
| 5 | `entities/media-post/model/__tests__/feedStore.spec.ts` | 222 | Лента, loadMore, infinite scroll cursor, выбор аккаунта |
| 6 | `entities/media-post/model/__tests__/searchStore.spec.ts` | 163 | Поиск по хэштегам/гео, сброс, пагинация |
| 7 | `entities/media-post/model/__tests__/commentStore.spec.ts` | 124 | Загрузка/отправка комментариев |
| 8 | `entities/user/model/__tests__/authStore.spec.ts` | 140 | Login/logout, fetchMe, token в localStorage |
| 9 | `entities/user/model/__tests__/adminUsersStore.spec.ts` | 80 | Список пользователей, управление ролями |

**Чек-лист для каждого store-теста:**
- [ ] `setActivePinia(createPinia())` в `beforeEach` (изоляция)
- [ ] Мок `@/boot/axios` через `vi.mock` — все HTTP-методы замоканы
- [ ] Каждый action: success-кейс + error-кейс (rejected promise)
- [ ] Loading-состояние проверяется (true во время запроса, false после)
- [ ] Error-состояние сбрасывается при повторном вызове
- [ ] Данные в `ref` обновляются корректно после `execute()`
- [ ] `*Api`-объекты не проникают в return store (энкапсуляция)
- [ ] Нет `.value` при обращении через store в тесте (Pinia UnwrapRef)
- [ ] Нет утечек состояния между тестами (правильный reset)
- [ ] Тестовые данные используют фабрики, а не захардкоженные объекты

---

### 1.3 Composable-тесты (6 файлов)

| # | Файл | Строк | Что проверить |
|---|------|-------|---------------|
| 1 | `shared/api/__tests__/useApi.spec.ts` | 64 | loading/response/error lifecycle, повторные вызовы |
| 2 | `shared/lib/__tests__/useFilterColumns.spec.ts` | 29 | Фильтрация visible колонок, toggle |
| 3 | `shared/lib/__tests__/useForwardProps.spec.ts` | 60 | Фильтрация undefined, реактивность |
| 4 | `shared/lib/__tests__/useModal.spec.ts` | 30 | open/close toggle, начальное состояние |
| 5 | `shared/lib/__tests__/useReverseInfiniteScroll.spec.ts` | 73 | Scroll detection, callback, cleanup |
| 6 | `shared/lib/__tests__/useSearchQuery.spec.ts` | 15 | Инициализация из URL, реактивность |

**Чек-лист для каждого composable-теста:**
- [ ] Composable вызывается внутри `setup` контекста (или обёрнут)
- [ ] Реактивность: изменение входных данных обновляет выходные
- [ ] Cleanup: `onBeforeUnmount` / event listeners снимаются
- [ ] Edge cases: пустые значения, undefined props
- [ ] `useApi`: проверен throw при ошибке (не silent fail)
- [ ] `useReverseInfiniteScroll`: мок window.scroll, scrollTo, scrollHeight

---

### 1.4 Компонент-тесты (4 файла)

| # | Файл | Строк | Что проверить |
|---|------|-------|---------------|
| 1 | `features/auth-login/ui/__tests__/LoginForm.spec.ts` | 118 | Submit, validation, ошибки, redirect |
| 2 | `shared/ui/media-card/__tests__/MediaCard.spec.ts` | 86 | Рендер thumbnail, overlay, клик |
| 3 | `shared/ui/modal-component/__tests__/ModalComponent.spec.ts` | 56 | Open/close, слоты, v-model |
| 4 | `shared/ui/table-component/__tests__/TableComponent.spec.ts` | 62 | Columns, rows, slots forwarding |

**Чек-лист для каждого компонент-теста:**
- [ ] Компонент монтируется без ошибок (`mount` / `shallowMount`)
- [ ] Props передаются и рендерятся корректно
- [ ] Events эмитятся при user interaction (`trigger('click')`, `trigger('submit')`)
- [ ] Слоты рендерятся (default + named)
- [ ] Quasar-компоненты замоканы (stubs) или установлен Quasar plugin
- [ ] `flushPromises()` после async-операций
- [ ] `defineOptions({ inheritAttrs: false })` — attrs пробрасываются через `v-bind`
- [ ] Нет прямого обращения к Quasar (только через обёртки из `shared/ui`)

---

### 1.5 Utility-тесты (4 файла)

| # | Файл | Строк | Что проверить |
|---|------|-------|---------------|
| 1 | `shared/lib/__tests__/formatters.spec.ts` | 105 | Все форматеры: числа, даты, длительность |
| 2 | `shared/lib/__tests__/validators.spec.ts` | 24 | Валидаторы форм: email, required, password |
| 3 | `shared/lib/__tests__/notify.spec.ts` | 41 | notifyError, notifySuccess — Quasar Notify мок |
| 4 | `shared/lib/__tests__/proxyImageUrl.spec.ts` | 19 | Проксирование URL изображений |

**Чек-лист для каждого utility-теста:**
- [ ] Граничные значения (0, null, undefined, пустая строка, очень длинная строка)
- [ ] Типичные значения (happy path)
- [ ] Форматирование дат: разные таймзоны / невалидные даты
- [ ] Валидаторы: все правила покрыты; возвращают `true | string`
- [ ] Нет side effects (чистые функции)

---

### 1.6 Прочие unit-тесты (3 файла)

| # | Файл | Строк | Что проверить |
|---|------|-------|---------------|
| 1 | `boot/__tests__/axios.spec.ts` | 63 | Interceptor для Authorization, baseURL |
| 2 | `router/__tests__/routes.spec.ts` | 152 | Guards: requiresAuth, requiresAdmin, redirects |
| 3 | `features/activity-live/lib/__tests__/useActivityLive.spec.ts` | 80 | WebSocket subscribe/unsubscribe, event handling |
| 4 | `features/generate-comment/lib/__tests__/useCommentGeneration.spec.ts` | 124 | WebSocket progress events, LLM generation flow |

**Чек-лист:**
- [ ] axios: interceptor добавляет `Authorization: Bearer <token>` когда токен есть
- [ ] axios: interceptor не добавляет header когда токена нет
- [ ] routes: неавторизованный → redirect на `/login`
- [ ] routes: non-admin → redirect с admin-страниц
- [ ] WebSocket: подписка на канал, обработка событий, отписка при unmount
- [ ] WebSocket: обработка ошибки подключения

---

## Раздел 2. Аудит интеграционного теста (1 файл)

**Файл:** `tests/integration/api.spec.ts` (163 строки)

### 2.1 Что проверить

- [ ] **Окружение:** тест корректно требует запущенный Docker-стек
- [ ] **Авторизация:** login возвращает валидный Sanctum-токен
- [ ] **Seed-данные:** тест полагается на конкретные seed-данные — задокументировано?
- [ ] **Изоляция:** тест не оставляет "мусор" в БД (создание/удаление в одном тесте)
- [ ] **Таймауты:** 15 сек — достаточно для CI?
- [ ] **Последовательность:** тесты зависят друг от друга (shared token)?
- [ ] **Покрытие API-эндпоинтов:**
  - [ ] `POST /api/login`
  - [ ] `GET /api/instagram-accounts`
  - [ ] `GET /api/feed/{accountId}`
  - [ ] `GET /api/activity-logs`
  - [ ] `GET /api/search/*`
  - [ ] `GET /api/llm-settings`
  - [ ] `GET /api/users` (admin)
- [ ] **Ответы:** проверяется структура `{ success, data, message }`
- [ ] **Ошибки:** тестируется хотя бы один 401/403/404 кейс
- [ ] **WebSocket:** проверяется connection к Reverb? (или пропущено?)

### 2.2 Рекомендации по расширению

- [ ] Добавить тест на создание/удаление Instagram-аккаунта (полный CRUD-цикл)
- [ ] Добавить тест на LLM settings CRUD (если не покрыт)
- [ ] Добавить тест на ошибку 422 (невалидные данные)
- [ ] Добавить тест на concurrent requests (race conditions)

---

## Раздел 3. Аудит E2E-тестов (8 файлов)

### 3.1 Общие проверки Playwright-конфигурации

- [ ] `baseURL` соответствует запущенному dev-серверу (порт 9000)
- [ ] `headless: true` для CI, `headed` через npm script для дебага
- [ ] Screenshot/video — only on failure (не раздувает артефакты)
- [ ] Retries: 0 — fail-fast подход (подходит ли для CI?)
- [ ] Timeout: 30 сек — достаточно?
- [ ] `webServer` — автозапуск Vite? Или ожидание запущенного?

### 3.2 Индивидуальные E2E-тесты

| # | Файл | Строк | Сценарии | Что проверить |
|---|------|-------|----------|---------------|
| 1 | `e2e/auth.spec.ts` | 42 | 4 | Логин, ошибки, redirect, admin guard |
| 2 | `e2e/feed.spec.ts` | 66 | 5 | Загрузка ленты, детали поста, смена аккаунта |
| 3 | `e2e/instagram-accounts.spec.ts` | 74 | 6 | Таблица, добавление, просмотр, поиск |
| 4 | `e2e/search.spec.ts` | 60 | ~4 | Хэштег-поиск, гео-поиск, результаты |
| 5 | `e2e/activity-logs.spec.ts` | 65 | 5 | Таблица логов, фильтры, expand row |
| 6 | `e2e/llm-settings.spec.ts` | 56 | ~3 | LLM-провайдер, параметры, admin-only |
| 7 | `e2e/admin-users.spec.ts` | 33 | ~2 | Список пользователей, admin-only |
| 8 | `e2e/navigation.spec.ts` | 50 | ~4 | Навигация, sidebar, breadcrumbs |

### 3.3 Чек-лист для каждого E2E-теста

**Стабильность:**
- [ ] Нет `waitForTimeout(ms)` — используются `waitForSelector` / `waitForResponse`
- [ ] Селекторы устойчивы: `data-testid`, role-based, а не хрупкие CSS-классы
- [ ] Нет зависимости от порядка тестов (каждый тест — самодостаточный)
- [ ] `beforeEach` выполняет логин (не полагается на cookie из предыдущего теста)

**Полнота:**
- [ ] Happy path покрыт
- [ ] Error path покрыт (невалидный ввод, сервер недоступен)
- [ ] Assertions — не только "элемент виден", но и содержимое проверяется
- [ ] Navigations — URL меняется корректно после action

**Качество:**
- [ ] Нет "спящих" тестов (sleep/timeout вместо ожидания)
- [ ] Нет хардкод-данных, которые зависят от БД-состояния
- [ ] Page Object Pattern? (или inline — для 8 файлов приемлемо)
- [ ] Переиспользование login-логики (helper / fixture?)

---

## Раздел 4. Кросс-уровневый анализ

### 4.1 Покрытие по FSD-слоям

| FSD-слой | Unit | Integration | E2E | Что может быть пропущено |
|----------|------|-------------|-----|--------------------------|
| `shared/api` | useApi | API calls | — | Error interceptor, retry logic |
| `shared/lib` | 9 файлов | — | — | echo.ts (WebSocket client) |
| `shared/ui` | 3 компонента | — | Через E2E | ButtonComponent, InputComponent, SelectComponent, ToggleComponent, MasonryGrid, MediaDisplay |
| `entities` | 13 файлов | Частично | Через E2E | Некоторые edge cases в DTO |
| `features` | 3 файла | — | Частично | activity-filter, delete-account, view-account, post-detail, instagram-user |
| `widgets` | 1 файл | — | Через E2E | instagram-accounts-list, activity-sidebar, activity-stats-cards, activity-summary-table, activity-grouped-stats |
| `pages` | — | — | 8 файлов | Все основные страницы покрыты E2E |

### 4.2 Проверить непокрытые области

- [ ] **shared/ui**: 3 из ~10 компонентов имеют тесты — покрыть оставшиеся?
- [ ] **features**: 3 из ~7 features имеют unit-тесты — оценить risk/value для оставшихся
- [ ] **widgets**: только 1 тест (responseFormatters) — виджеты тестируются только через E2E
- [ ] **echo.ts** (WebSocket client) — тестируется ли подключение?
- [ ] **Pages**: нет unit-тестов (допустимо, если покрыты E2E)

### 4.3 Проверка мок-стратегии

- [ ] Моки `@/boot/axios` — консистентны ли между store-тестами?
- [ ] Глобальные моки в `src/__mocks__/` — используются ли везде, где нужно?
- [ ] Quasar stubs — единообразный подход во всех компонент-тестах?
- [ ] Нет ли "мертвых" моков (замоканы, но не используются)?
- [ ] Моки не скрывают реальные баги (слишком "жадный" мок)?

### 4.4 Проверка тестовых данных

- [ ] Фабрики (`makeAccountApi`, `makeFeedResponse`) — переиспользуются?
- [ ] Нет дублирования фабрик между тестами
- [ ] Seed-данные для E2E/integration документированы
- [ ] Тестовые credentials (`user@insta-pilot.local` / `password`) — единое место

---

## Раздел 5. Качество и паттерны

### 5.1 Общие code quality проверки

- [ ] Нет `any` в тестах — типизация тестовых данных
- [ ] Нет `@ts-ignore` / `@ts-expect-error` без объяснения
- [ ] `describe/it` описания информативны (на русском или английском — единообразно?)
- [ ] `beforeEach` используется для setup, `afterEach` для cleanup
- [ ] Нет утечек таймеров (`vi.useFakeTimers()` → `vi.useRealTimers()`)
- [ ] Тесты не зависят от порядка выполнения
- [ ] Каждый `it` блок — один assertion concern (не mega-тесты)

### 5.2 Соответствие конвенциям проекта (CLAUDE.md)

- [ ] Стрелочные функции без `{}` где возможно
- [ ] Полные имена параметров (не `e`, `r`, `a`)
- [ ] Trailing comma не используется
- [ ] Импорты через `@/` (не `./` или `../`)
- [ ] `.value` не используется в шаблонах (для компонент-тестов)

### 5.3 Проверка ESLint/TypeScript

- [ ] `npx eslint --fix ./src` — нет ошибок в тестовых файлах
- [ ] `npx vue-tsc --noEmit` — нет TS-ошибок в тестах
- [ ] `noUncheckedIndexedAccess` — тесты корректно обрабатывают опциональный доступ

---

## Раздел 6. Рекомендации и action items

### 6.1 Высокий приоритет (потенциальные баги)
- [ ] Проверить все store-тесты: покрыт ли error-кейс каждого action
- [ ] Проверить E2E: нет ли flaky-тестов из-за timing issues
- [ ] Проверить integration-тест: изоляция данных между тестами

### 6.2 Средний приоритет (полнота покрытия)
- [ ] Оценить необходимость unit-тестов для непокрытых shared/ui компонентов
- [ ] Оценить необходимость unit-тестов для features (activity-filter, post-detail, etc.)
- [ ] Добавить snapshot-тесты для UI-компонентов?

### 6.3 Низкий приоритет (улучшения)
- [ ] Вынести общие фабрики тестовых данных в `tests/factories/`
- [ ] Добавить coverage threshold в vitest.config.ts
- [ ] Рассмотреть Page Object Pattern для E2E (если тесты растут)
- [ ] CI pipeline: автозапуск всех трёх уровней тестов

---

## Порядок выполнения аудита

| Этап | Действие | Приоритет |
|------|----------|-----------|
| 1 | Запустить все тесты, зафиксировать текущий статус (pass/fail) | Высокий |
| 2 | Аудит store-тестов (раздел 1.2) — самый критичный слой | Высокий |
| 3 | Аудит DTO-тестов (раздел 1.1) — data integrity | Высокий |
| 4 | Аудит E2E-тестов (раздел 3) — стабильность и полнота | Высокий |
| 5 | Аудит integration-теста (раздел 2) — покрытие API | Средний |
| 6 | Аудит composable-тестов (раздел 1.3) | Средний |
| 7 | Аудит компонент-тестов (раздел 1.4) | Средний |
| 8 | Кросс-уровневый анализ (раздел 4) — пробелы покрытия | Средний |
| 9 | Code quality и паттерны (раздел 5) | Низкий |
| 10 | Формирование итогового отчёта с рекомендациями | Финал |
