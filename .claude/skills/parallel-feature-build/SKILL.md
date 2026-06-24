---
name: parallel-feature-build
description: Разворачивает фичу insta-pilot на параллельные Kiro-делегаты (5–7 независимых FSD-слайсов: дашборды/таблицы-страницы), изолирует каждого в git-worktree, держит shared-слой когерентным и сводит результат через ветки. Использовать, когда фича дробится на независимые единицы, трогающие в основном новые файлы.
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
3. **Запуск воркеров (Kiro-делегаты, НЕ субагенты Claude)**: на каждую единицу —
   а) создай worktree сам: `git worktree add .claude/worktrees/<name> -b worktree-<name>`;
   б) `mcp__kiro-cli__delegate(task=<бриф>, workdir=<абс. путь worktree>, model="claude-opus-4.8"
      или "claude-sonnet-4.6", effort="max")`. Бриф — `docs/orchestration/kiro-worker-brief.md`:
      scope (какие папки создаёт), пути shared-контрактов для чтения, ветка `worktree-<name>`,
      запрет seam-файлов и существующего shared-слоя, команды проверки. Правила FSD Kiro получит
      из `CLAUDE.md` автоматически.
   Сохрани `session_id` каждого воркера — правки по итогам ревью идут через `reply(session_id,…)`,
   не своей рукой (зоны реализации блокирует хук `guard-delegation.py`). Воркеры в РАЗНЫХ worktree →
   `session_id` извлекается корректно даже при параллели (снимок фильтрует по `cwd`), и параллель тут
   НАСТОЯЩАЯ (разные cwd/аккаунты). Параллельность ТОЛЬКО через `delegate_batch` (с 2026-06-24): один
   вызов с `items` (по воркеру на worktree) → сервер гонит до `KIRO_MAX_CONCURRENCY` (дефолт **3**)
   конкурентно, фан-аут 5–7 идёт ВОЛНАМИ по 3. Отдельные `delegate` одним сообщением НЕ параллелятся —
   Claude Code сериализует их (см. `playbook.md` §6). single-account 3 одновременных подтверждены живьём (2026-06-24).
4. **Интеграция**: ревью diff каждой ветки (только новые слайсы, seam не тронут) → merge по одной
   ветке в основную → отдельным финальным шагом зарегистрируй маршруты в `src/router/routes.ts`
   (child-route под `MainLayout`, lazy `@/pages/<name>/ui/<Name>Page.vue`) и табы в
   `src/layouts/AppNavTabs.vue`. `cherry-pick` — для точечного переноса чистого коммита; `stash` —
   только для временного разведения контекста.
5. **Финал**: ESLint autofix → `vue-tsc --noEmit` → smoke-рендер страниц → `git worktree remove`
   для отработавших worktree.

Полный плейбук с worked-example и оговорками по контексту/git/провайдеру: `docs/orchestration/playbook.md`.
