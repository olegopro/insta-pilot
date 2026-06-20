# Параллельная мульти-агентная оркестрация — плейбук

Детальная процедура к разделу «Параллельная мульти-агентная оркестрация» в корневом `CLAUDE.md`.
Цель: по одной фиче развернуть 5–7 параллельных субагентов (например, дашборды/таблицы-страницы),
держать кодовую базу когерентной, изолировать git через worktree и гарантировать каждому агенту
полный контекст проекта.

Все механики ниже сверены с документацией Claude Code. Где поведение «по умолчанию» отличается от
«надо настроить» — это явно отмечено.

## 1. Модель параллелизма

- Субагенты запускаются через инструмент Task/Agent, работают в рамках одной сессии, каждый со своим
  окном контекста. Вложенность — до 5 уровней; для 5–7 дашбордов вложенность не нужна (depth 1).
- Несколько агентов можно отправить одним сообщением (несколько вызовов Agent-tool сразу) — тогда
  они идут конкурентно. Foreground-агенты блокируют диалог до завершения; background-агенты — нет.
- Параллелизм ограничен НЕ числом агентов, а изоляцией контекста и (в нашем случае) пропускной
  способностью провайдера (см. раздел 6 про Kiro request-spacing).

## 2. Когда разворачивать

Критерий fan-out: задача дробится на ≥3 единицы, каждая из которых трогает преимущественно НОВЫЕ
файлы. В терминах FSD это естественно: новый дашборд = новый набор слайсов, конфликтующих только по
нескольким shared-seam файлам.

Не разворачивать, если правки сильно связаны или почти всё идёт в одни shared-файлы — выигрыша нет,
только merge-конфликты.

## 3. Гарантия полного контекста каждому агенту

### 3.1 Что приходит по умолчанию (без настройки)
Не-fork субагент на старте автоматически грузит весь стек памяти, который грузит главный диалог:
`~/.claude/CLAUDE.md`, корневой `CLAUDE.md` проекта, его `@import`-ы (раскрываются рекурсивно, макс.
4 хопа) и auto-memory (первые 200 строк или 25 КБ `MEMORY.md`). Никакой конфигурации для этого не
требуется — правила проекта доходят сами.

### 3.2 Единственное исключение — встроенные Explore и Plan
Они намеренно пропускают `CLAUDE.md` и git-status ради скорости/дешевизны. Если оркестратор
раздаёт работу через Explore/Plan, критичные правила (FSD-слои, барреллы/public API, паттерн
стора и таблицы, контракт shared-компонентов) ОБЯЗАТЕЛЬНО повторить в delegation-промпте. Все
остальные встроенные и кастомные субагенты грузят `CLAUDE.md` сами.

### 3.3 Что всё равно кладём в Task-промпт каждому агенту
Даже при авто-загрузке `CLAUDE.md` промпт каждого агента должен содержать:
1. Точный scope: какие слайсы агент СОЗДАЁТ (page + widgets + entity) и какие файлы трогать нельзя.
2. Пути shared-контрактов для ЧТЕНИЯ (компоненты/хуки/DTO, которые он переиспользует).
3. Имя ветки/worktree.
4. Явный запрет на seam-файлы (`routes.ts`, `AppNavTabs.vue`, бэковые `api.php`/`AppServiceProvider`).
5. Команды проверки (lint/tsc) перед коммитом.

Важная оговорка: `CLAUDE.md` — это контекст, а не принудительная конфигурация; агент может не
выполнить инструкцию. Чем конкретнее и короче промпт, тем выше следование. Жёсткий запрет действия
делается не текстом, а PreToolUse-хуком.

### 3.4 «Токенов не жалеем, контекст на каждую новую сессию»
`CLAUDE.md` и auto-memory грузятся заново на старте каждой новой сессии автоматически — отдельной
команды инъекции нет и не нужно. Если нужен расширенный контекст сверх 200-строчного `CLAUDE.md` —
вынести его в отдельный файл и подключить через `@import` (он раскроется рекурсивно и попадёт в
субагентов). В этом репозитории сейчас 0 `@import`-ов, доки подключаются plain-ссылкой; вводить
`@import` стоит осознанно. Не полагаться на SessionStart-хук для ПОСТОЯННОГО контекста — его
`additionalContext` инъектится разово и не переживает компакт/перезапуск; долговременный контекст —
только `CLAUDE.md` и `MEMORY.md` на диске.

### 3.5 Чек-лист гарантии контекста
- [ ] `/memory` показывает корневой `CLAUDE.md` и (если есть) `MEMORY.md` — иначе они не дойдут.
- [ ] Критичные правила лежат в первых ~200 строках `CLAUDE.md` (порог auto-memory) либо в самом
      `CLAUDE.md` (он грузится целиком, лимит 200/25КБ — только для `MEMORY.md`).
- [ ] Оркестратор НЕ использует Explore/Plan для написания кода; если использует — правила
      продублированы в промпте.
- [ ] Task-промпт каждого агента содержит scope + пути контрактов + ветку + запрет seam-файлов.

## 4. Git: изоляция через worktree и интеграция

### 4.1 Изоляция
- Worktree включается `isolation: worktree` во frontmatter кастомного субагента, либо просьбой
  «используй worktree для своих агентов». Каждый агент получает `.claude/worktrees/<name>/` и ветку
  `worktree-<name>`, общую историю репозитория, изолированные файлы.
- По умолчанию worktree ветвится от дефолтной ветки (origin/HEAD). Чтобы ветвиться от текущего HEAD
  (например, если работа идёт в feature-ветке), задать `worktree.baseRef: head` в settings.
- Оговорка про зависимости: worktree НЕ изолирует `node_modules/`. Тяжёлый `npm install` в каждом
  worktree параллельно может конкурировать; для дашбордов это обычно не нужно — правки чисто в `src`,
  а typecheck гоняем в общем контейнере после слияния.

### 4.2 Авто-уборка (точная формулировка)
Worktree удаляется автоматически ТОЛЬКО если в нём нет незакоммиченных правок, нет untracked-файлов
и нет новых коммитов. Worktree с любыми изменениями сам не удаляется — нужен `git worktree remove`
вручную либо он уйдёт по `cleanupPeriodDays` (если условие «без изменений» сохранится). Вывод:
каждый агент ОБЯЗАН закоммитить свою единицу, иначе результат может быть подметён уборкой или
потребует ручного спасения.

### 4.3 Процедура интеграции
1. Каждый агент коммитит свою единицу в свою ветку `worktree-<name>` (один слайс — один коммит,
   осмысленное сообщение).
2. Оркестратор подтягивает ветки агентов в основной чекаут.
3. Ревью diff каждой ветки: проверить, что агент НЕ тронул seam-файлы и следовал контракту
   shared-компонентов (одинаковые импорты `@/shared/ui/*`, паттерн таблицы/стора).
4. Merge по одному слайсу в основную ветку. Линейная история — fast-forward; иначе обычный merge.
5. `cherry-pick` — точечно, когда из ветки агента нужен один чистый коммит (например, агент сделал
   и слайс, и случайную правку seam — берём только слайс).
6. `stash` — лишь для временного разведения контекста внутри сессии оркестратора, не для интеграции.
7. Регистрация в seam-файлах (`routes.ts`, `AppNavTabs.vue`, бэк `api.php`/`AppServiceProvider`) —
   ОТДЕЛЬНЫЙ финальный шаг, делает оркестратор или один агент последовательно после слияния слайсов.
8. Финальная проверка целостности на основной ветке: ESLint autofix → `vue-tsc --noEmit` →
   smoke-рендер страниц (см. workflow в корневом `CLAUDE.md`, раздел «Отладка ошибок»).
9. После merge: `git worktree remove` для отработавших worktree.

## 5. Worked example: «5 дашбордов параллельно»

Задача: добавить 5 страниц-дашбордов аналитики, каждый со своей таблицей/виджетами, переиспользуя
общий слой `shared/ui` и паттерн таблиц. Реальная FSD-структура проекта (frontend-vue/src):

```
pages/      logs/  feed/  search/  instagram-accounts/  llm-settings/  admin-users/
widgets/    activity-log-table/  activity-stats-cards/  activity-summary-table/  ...
entities/   activity-log/  instagram-account/  llm-settings/  media-post/  user/
shared/ui/  page-component/  table-component/  table-tools-wrapper/  card-component/ ...
shared/lib/ useFilterColumns  useSearchQuery  notify  formatters  ...
router/     routes.ts  guard.ts  index.ts
layouts/    MainLayout.vue  AppNavTabs.vue
```

Эталон, на который смотрят агенты (страница logs): `src/pages/logs/ui/LogsPage.vue` оборачивает
контент в `PageComponent` из `@/shared/ui/page-component`, импортирует виджеты через барреллы
(`@/widgets/activity-log-table`), данные берёт из Pinia-стора `@/entities/activity-log/model/
activityLogStore.ts`, маппит DTO, таблицу строит через `TableComponent` из
`@/shared/ui/table-component` + `useFilterColumns(<entity>TableColumns)` + `useSearchQuery()`.

### Шаг 0 — оркестратор готовит шов (ДО фан-аута, последовательно)
- Если нужен новый общий блок (напр. `shared/ui/stat-tile-component/`) — создать его ОДИН раз
  собственноручно, с `index.ts`-барреллом. Агенты его потом только читают.
- Зафиксировать контракт: все дашборды используют `PageComponent`, `TableComponent`,
  `useFilterColumns`/`useSearchQuery`, DTO-паттерн `apiTypes(snake)→types(camel)→*DTO`.

### Шаг 1 — декомпозиция на 5 независимых единиц
Каждый дашборд = независимый набор слайсов, агент создаёт ТОЛЬКО новые папки:
- Агент 1 «users-analytics»: `pages/users-analytics/`, `widgets/users-overview-table/`,
  `entities/users-analytics/`.
- Агент 2 «revenue»: `pages/revenue/`, `widgets/revenue-summary-table/`, `entities/revenue/`.
- Агент 3 «traffic»: `pages/traffic/`, `widgets/traffic-chart-card/`, `entities/traffic/`.
- Агент 4 «retention»: `pages/retention/`, `widgets/retention-cohort-table/`, `entities/retention/`.
- Агент 5 «funnel»: `pages/funnel/`, `widgets/funnel-steps-table/`, `entities/funnel/`.

Каждый слайс-страница: `pages/<name>/ui/<Name>Page.vue` + `pages/<name>/index.ts`
(`export { default as <Name>Page }`). Виджет: `widgets/<name>/ui/<Component>.vue` + `index.ts`.
Entity: `entities/<name>/model/` с `apiTypes.ts` (snake, суффикс `Api`), `types.ts` (camel),
`<name>DTO.ts`, `<name>TableColumns.ts`, `<name>Store.ts`, барреллом `index.ts`.

### Шаг 2 — запуск агентов в worktree
Запустить 5 субагентов `dashboard-builder` (см. `.claude/agents/dashboard-builder.md`), у каждого
`isolation: worktree`. Промпт каждому (пример для агента 1):

> Создай дашборд «users-analytics» как новый набор FSD-слайсов. СОЗДАВАЙ ТОЛЬКО новые папки:
> `src/pages/users-analytics/`, `src/widgets/users-overview-table/`, `src/entities/users-analytics/`.
> Эталон копируй по структуре с `src/pages/logs/ui/LogsPage.vue` и слайса `entities/activity-log`.
> Обязательно: страницу оборачивай в `PageComponent` (`@/shared/ui/page-component`), таблицу строй
> через `TableComponent` (`@/shared/ui/table-component`) + `useFilterColumns(usersAnalyticsTableColumns)`
> + `useSearchQuery()`. DTO-паттерн apiTypes(snake)→types(camel)→DTO. ЗАПРЕЩЕНО трогать
> `src/router/routes.ts`, `src/layouts/AppNavTabs.vue` и любые существующие `shared/ui|lib` файлы.
> Ветка: `worktree-users-analytics`. Перед коммитом: `eslint --fix ./src` и `vue-tsc --noEmit`.
> Закоммить результат одним осмысленным коммитом.

(Правила FSD дойдут из `CLAUDE.md` сами; в промпте дублируется только scope + контракт + запреты,
плюс на случай Explore/Plan — но для кода используем `dashboard-builder`, а не Explore/Plan.)

### Шаг 3 — интеграция (оркестратор)
1. Ревью каждой ветки: только новые папки слайсов, seam-файлы не тронуты.
2. Merge 5 веток по одной в основную.
3. Один финальный шаг — регистрация маршрутов и навигации (seam):
   - в `src/router/routes.ts` добавить 5 child-route под `MainLayout` (lazy
     `@/pages/<name>/ui/<Name>Page.vue`, `meta: { requiresAuth: true }`, при необходимости
     `requiresAdmin`).
   - в `src/layouts/AppNavTabs.vue` добавить `<q-route-tab to="/<name>" label="…" />`.
4. ESLint autofix → `vue-tsc --noEmit` → открыть каждую страницу (smoke).
5. `git worktree remove` для пяти worktree.

### Если дашбордам нужен бэкенд
На каждый endpoint трогаются seam-файлы бэка (`routes/api.php`, `AppServiceProvider.php`) — это
сериализуемый шов. Варианты: (а) контроллеры/сервисы/репозитории (новые файлы) пишут агенты, а
регистрацию роутов и биндингов сводит оркестратор последовательно; (б) бэкенд готовит оркестратор
до фан-аута, агенты делают только фронт. Контракт фронт↔бэк: snake_case `apiTypes.ts` ↔ camelCase
`types.ts` ↔ `*DTO`, конверт ответа `{ success, data, message }`.

## 6. Маршрутизация через 3 Kiro-канала

### Архитектурное решение
Claude Code умеет смотреть только на ОДИН base URL (`ANTHROPIC_BASE_URL`). Он меняет КУДА уходят
запросы, НЕ какая модель отвечает, и НЕ даёт встроенной балансировки по нескольким бэкендам. Поэтому
балансировку по 3 Kiro-аккаунтам делает CLI Proxy (порт 8318, Anthropic-совместимый Messages API),
а Claude Code просто на него смотрит. Per-agent override во frontmatter поддержан только для `model`,
для base URL — нет; все субагенты идут через один и тот же endpoint.

### Конфиг (требует подтверждения пользователя перед включением)
`.claude/settings.json` в проекте:
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:8318",
    "ANTHROPIC_API_KEY": "<ключ-для-CLI-Proxy>"
  }
}
```
Проверка: `/status` должен показать endpoint `localhost:8318`.

### Оговорки
- **Tool-name limit**: Kiro-бэкенд ограничивает имена инструментов 64 символами — длинные MCP-имена
  могут ломаться. Для дашбордов хватает базовых Read/Edit/Bash, риск низкий.
- **Request-spacing**: CLI Proxy применяет паузу per-account (per-auth), не per-session. При одном
  активном Kiro-аккаунте параллельные агенты сериализуются паузами; для реальной конкуренции нужно
  включить дополнительные аккаунты в конфиге прокси.
- **Нет авто-fallback на Anthropic**: при ошибке Kiro Claude Code повторяет Kiro, а не уходит на
  api.anthropic.com. `--fallback-model` меняет модель, не провайдера.
- **Tool Search / extended thinking** на Kiro могут не работать — для оркестрации дашбордов не нужны.
