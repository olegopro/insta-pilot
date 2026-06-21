---
name: parallel-feature-build
description: Разворачивает фичу insta-pilot на параллельные субагенты (5–7 независимых FSD-слайсов: дашборды/таблицы-страницы), изолирует каждого в git-worktree, держит shared-слой когерентным и сводит результат через ветки. Использовать, когда фича дробится на независимые единицы, трогающие в основном новые файлы.
---

## Контекст репозитория

FSD-структура фронтенда:
!`ls frontend-vue/src/pages frontend-vue/src/widgets frontend-vue/src/entities frontend-vue/src/shared/ui 2>/dev/null`

Seam-файлы (НЕ отдавать агентам параллельно):
!`echo 'router/routes.ts | layouts/AppNavTabs.vue | backend routes/api.php | AppServiceProvider.php'`

## Процедура

1. **Декомпозиция**: разбей фичу на 3–7 независимых единиц. Единица = новый набор слайсов
   (`pages/<name>/` + `widgets/<name>/` + `entities/<name>/`), пересекающийся с другими только по
   shared-слою и seam-файлам. Покажи план пользователю до запуска.
2. **Подготовка шва (последовательно, ДО фан-аута)**: если нужен новый общий блок — создай его сам
   в `src/shared/ui/<kebab>/` с барреллом `index.ts`. Агенты shared-слой только читают.
3. **Запуск агентов**: на каждую единицу запусти субагент `dashboard-builder` (worktree-изоляция).
   В промпте каждому передай: точный scope (какие папки создаёт), пути shared-контрактов для чтения,
   имя ветки `worktree-<name>`, запрет трогать seam-файлы и существующий shared-слой, команды
   проверки перед коммитом. Правила FSD придут из `CLAUDE.md` автоматически (кроме Explore/Plan —
   их для написания кода не используй).
4. **Интеграция**: ревью diff каждой ветки (только новые слайсы, seam не тронут) → merge по одной
   ветке в основную → отдельным финальным шагом зарегистрируй маршруты в `src/router/routes.ts`
   (child-route под `MainLayout`, lazy `@/pages/<name>/ui/<Name>Page.vue`) и табы в
   `src/layouts/AppNavTabs.vue`. `cherry-pick` — для точечного переноса чистого коммита; `stash` —
   только для временного разведения контекста.
5. **Финал**: ESLint autofix → `vue-tsc --noEmit` → smoke-рендер страниц → `git worktree remove`
   для отработавших worktree.

Полный плейбук с worked-example и оговорками по контексту/git/провайдеру: `docs/orchestration/playbook.md`.
