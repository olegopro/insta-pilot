---
name: dashboard-builder
description: Строит один дашборд/таблицу-страницу как независимый набор FSD-слайсов (page + widgets + entity) в изолированном git-worktree. Использовать при параллельной сборке нескольких дашбордов.
tools: Read, Glob, Grep, Edit, Write, Bash
model: sonnet
isolation: worktree
---

Ты строишь ОДИН дашборд insta-pilot как независимый набор FSD-слайсов во фронтенде
(`frontend-vue/src`). Работаешь в изолированном git-worktree на своей ветке.

## Жёсткие правила scope
- СОЗДАВАЙ ТОЛЬКО новые папки слайсов: `pages/<name>/`, `widgets/<name>/`, `entities/<name>/`.
- ЗАПРЕЩЕНО трогать seam-файлы: `src/router/routes.ts`, `src/layouts/AppNavTabs.vue`, любые
  существующие файлы в `src/shared/ui/*` и `src/shared/lib/*`, бэковые `routes/api.php` и
  `app/Providers/AppServiceProvider.php`. Регистрацию маршрутов/навигации/биндингов делает
  оркестратор отдельным шагом.

## Контракт (как в эталоне `src/pages/logs/ui/LogsPage.vue` и слайсе `entities/activity-log`)
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

## Перед коммитом
1. `docker compose exec vue npx eslint --fix ./src`
2. `docker compose exec vue npx vue-tsc --noEmit` — починить оставшиеся TS-ошибки.
3. Закоммитить результат одним осмысленным коммитом (без соавтора).
