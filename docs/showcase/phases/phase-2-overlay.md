# Phase 2 — Локальная обёртка (overlay) + рабочая область + drag

> «Умная обёртка над лентой»: локальный план-порядок, заметки, локальное скрытие — всё в БД, в IG НЕ
> уходит. Рабочая область снизу. Drag сетки (vuedraggable). Реальных IG-мутаций здесь ещё нет (Phase 3).

## Объём

- Миграция `create_showcase_media_overlays_table` (см. [`../data-model.md`](../data-model.md)) — оркестратор.
- Laravel: модель `ShowcaseMediaOverlay`, `ShowcaseOverlayRepository` (+ интерфейс, bind в AppServiceProvider —
  оркестратор), `ShowcaseOverlayController::updateOverlay/reorderBoard`; мёрдж overlay в `ShowcaseController::medias`.
- Vue: `features/edit-showcase-note`, `features/reorder-showcase-grid` (vuedraggable), `widgets/showcase-work-area`;
  расширение `showcaseStore` (updateOverlay, reorderBoard, оптимистичные апдейты).
- Seam: `vuedraggable@^4` в `package.json` — оркестратор.

## Механика

- Drag сетки → новый порядок → `PUT /board/order` (батч `board_position`). Оптимистично на фронте, откат при ошибке.
- Overlay-строка создаётся лениво (`findOrNew`) при первой пометке/перетаскивании.
- Рабочая область (`showcase-work-area`): выбранный пост — превью + заметка + переключатели
  `is_hidden_local`/`is_ad`(подготовка к Phase 4)/labels. `is_hidden_local` — затемняет/прячет в доске, IG не трогает.
- Слияние и сортировка — по правилам `../data-model.md` (позиция != null → по позиции, остальное хронологией).
- **Важно:** доска — локальный план; в шапке/подсказке UI явно «порядок виден только здесь, в Instagram не меняется».

## Чек-лист

- [ ] Миграция + модель + репозиторий + bind; мёрдж overlay в выдачу `medias`.
- [ ] Контроллер overlay (ownership, валидация) + роуты #4,#5.
- [ ] FE: drag (vuedraggable), work-area, заметки, локальное скрытие; оптимистичные апдейты + откат.
- [ ] eslint/vue-tsc чисто; BE-тесты (overlay CRUD, reorder-транзакция, ownership 403); FE-тесты (DTO/merge).
- [ ] Live-check: перетащил → сохранилось → после reload порядок доски сохранён (в нашей БД); заметки/скрытие персистят.

## Критерий готовности (gate → Phase 3)

Локальная обёртка полностью работает и переживает reload (из нашей БД), IG при этом не затрагивается.
Явно показано пользователю, что это локальный план.

## Делегирование

- Миграция/bind/`package.json` — оркестратор (швы).
- **Kiro Opus (max)** — Laravel overlay (модель/репо/контроллер/мёрдж, транзакция reorder).
- **Kiro Sonnet (max)** — FE drag + work-area + store в своём worktree.
