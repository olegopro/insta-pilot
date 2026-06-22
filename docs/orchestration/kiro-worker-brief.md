# Бриф Kiro-воркера — один дашборд (FSD-слайс)

Reference-задание для **Kiro-делегата** (НЕ субагента Claude). Оркестратор вставляет его в
`mcp__kiro-cli__delegate(task=…, workdir=<путь worktree>, model=…, effort=max)` при параллельной
сборке дашбордов. Kiro сам читает/правит файлы в своём `workdir` и коммитит. Проектный `CLAUDE.md`
подмешивается в промпт делегата автоматически — FSD-правила повторять не нужно, только scope,
контракт-срез и запреты. (Раньше воркером был Claude-субагент `dashboard-builder`; переведено на Kiro
по политике «реализация → Kiro», корневой `CLAUDE.md` → «Делегирование исполнителям».)

## Что оркестратор подставляет в `task`
- Имя единицы `<name>` и точный scope (какие папки воркер СОЗДАЁТ).
- Пути shared-контрактов для ЧТЕНИЯ (что переиспользует).
- Имя ветки `worktree-<name>` — сам worktree оркестратор уже создал (см. `playbook.md` §5).
- Команды проверки перед коммитом.

## Жёсткие правила scope (всегда в `task`)
- СОЗДАВАЙ ТОЛЬКО новые папки слайсов: `pages/<name>/`, `widgets/<name>/`, `entities/<name>/`.
- ЗАПРЕЩЕНО трогать seam-файлы: `src/router/routes.ts`, `src/layouts/AppNavTabs.vue`, любые
  существующие файлы в `src/shared/ui/*` и `src/shared/lib/*`, бэковые `routes/api.php` и
  `app/Providers/AppServiceProvider.php`. Регистрацию маршрутов/навигации/биндингов делает оркестратор.

## Контракт (эталон `src/pages/logs/ui/LogsPage.vue` и слайс `entities/activity-log`)
- Страница: `pages/<name>/ui/<Name>Page.vue` оборачивается в `PageComponent` из
  `@/shared/ui/page-component`; баррелл `pages/<name>/index.ts` экспортирует `<Name>Page`.
- Таблицы — только `TableComponent` из `@/shared/ui/table-component` (никогда не сырой `q-table`),
  с `useFilterColumns(<name>TableColumns)` + `useSearchQuery()`; строки = `<name>ListDTO.toLocal(...)`.
- Виджет: `widgets/<name>/ui/<Component>.vue` (PascalCase) + баррелл `index.ts`.
- Entity `entities/<name>/model/`: `apiTypes.ts` (snake_case, суффикс `Api`), `types.ts` (camelCase),
  `<name>DTO.ts`/`<name>ListDTO.ts` (маппинг Api→local), `<name>TableColumns.ts` (с RowModel),
  `<name>Store.ts` (Pinia, данные через `useApi` + axios из `@/boot/axios`), `index.ts`-барелл,
  экспортирующий только публичные символы.
- Импорты строго вверх по слоям и только через алиасы `@/<layer>/<slice>`, без глубоких путей.

## Перед коммитом (Kiro выполняет в `workdir`)
1. `docker compose exec vue npx eslint --fix ./src`
2. `docker compose exec vue npx vue-tsc --noEmit` — починить оставшиеся TS-ошибки.
3. Закоммитить результат одним осмысленным коммитом (без соавтора) в ветку `worktree-<name>`.

## Модель и мышление
`claude-opus-4.8` (макс качество) или `claude-sonnet-4.6` (баланс), `effort=max`. Узкие/дешёвые
правки — `glm-5` (без мышления).
