# План рефакторинга CSS

## Цель

Сократить папку `src/css/` до **2 файлов**:
- `quasar.variables.scss` — design tokens (без изменений, auto-injected Quasar)
- `app.scss` — все оставшиеся глобальные стили, разделённые секциями-комментариями

Все компонентно-специфичные стили перенести в `<style>` соответствующих `.vue` файлов.

---

## Текущая структура (ДО)

```
src/css/
├── app.scss                      # Entry point (импортирует всё ниже)
├── quasar.variables.scss         # Design tokens
├── base/
│   ├── _reset.scss               # body, box-sizing, img, a
│   ├── _transitions.scss         # 0 использований — УДАЛИТЬ
│   └── _typography.scss          # 0 использований — УДАЛИТЬ
├── components/
│   ├── _q-btn.scss               # → ButtonComponent.vue
│   ├── _q-input.scss             # → InputComponent.vue
│   ├── _q-table.scss             # → TableComponent.vue
│   ├── _q-card.scss              # → CardComponent.vue (НОВЫЙ)
│   ├── _q-dialog.scss            # → ModalComponent.vue
│   ├── _q-tabs.scss              # → AppNavTabs.vue
│   └── _q-toolbar.scss           # → MainLayout.vue
├── layouts/
│   └── _main-layout.scss         # → MainLayout.vue + PageComponent.vue
├── tokens/                       # 0 CSS, только комментарии — УДАЛИТЬ
│   ├── _colors.scss
│   ├── _borders.scss
│   ├── _shadows.scss
│   ├── _spacing.scss
│   ├── _typography.scss
│   └── _z-index.scss
└── utilities/
    └── _helpers.scss             # 2 из ~70 классов используются
```

## Целевая структура (ПОСЛЕ)

```
src/css/
├── quasar.variables.scss         # Без изменений
└── app.scss                      # Единый файл (секции ниже)
```

Содержимое `app.scss` (секции):
```
/* ========================================
   RESET
   ======================================== */
   body, box-sizing, img, a

/* ========================================
   LAYOUT
   ======================================== */
   .q-page.page-content (max-width + centering)

/* ========================================
   UTILITIES
   ======================================== */
   .border-lg (единственная используемая утилита)
```

---

## Шаги реализации

### Шаг 1. Создать CardComponent (shared/ui/card-component/)

**Почему:** `q-card` используется напрямую в 5 файлах (13 инстансов), нет обёртки.

**Где используется q-card / q-card-section:**

| Файл | q-card | q-card-section | q-card-actions | Пропсы q-card |
|------|--------|----------------|----------------|---------------|
| ProfileCard.vue | 1 | 1 | — | style="min-width: 360px" |
| ActivityStatsCards.vue | 4 | 4 | — | flat bordered class="col stat-card" |
| ActivityGroupedStats.vue | 2 | 2 | — | flat bordered class="col" |
| LoginPage.vue | 1 | 1 | — | class="login-card" |
| LlmSettingsPage.vue | 1 | 2 | 1 | class="llm-form q-mt-lg" style="max-width: 640px" |

**Компонент:**
- `CardComponent.vue` — обёртка над `q-card` (по паттерну ButtonComponent)
- `CardSectionComponent.vue` — обёртка над `q-card-section`
- `CardActionsComponent.vue` — обёртка над `q-card-actions`
- Стили из `_q-card.scss` перенести в `CardComponent.vue` через `:deep()`
- Заменить все `<q-card>` на `<CardComponent>` по проекту

### Шаг 2. Удалить неиспользуемое

- [x] `tokens/` — удалить всю папку (6 файлов, только комментарии)
- [x] `base/_transitions.scss` — 0 использований
- [x] `base/_typography.scss` — 0 использований

### Шаг 3. Перенести Quasar overrides в wrapper-компоненты

Каждый override перенести в `<style lang="scss">` (без scoped, или с `:deep()`) соответствующего компонента:

| CSS файл | Целевой компонент | Стили |
|----------|-------------------|-------|
| `_q-btn.scss` | `ButtonComponent.vue` | `.q-btn { border-radius: $radius-md }` |
| `_q-input.scss` | `InputComponent.vue` | `.q-field--outlined .q-field__control { border-radius: $radius-md }` |
| `_q-table.scss` | `TableComponent.vue` | thead/tbody стили, hover, border-radius container |
| `_q-dialog.scss` | `ModalComponent.vue` | `.q-dialog__inner > .q-card { border-radius: $radius-xl, box-shadow }` |
| `_q-tabs.scss` | `AppNavTabs.vue` | `.q-tab { text-transform: none, font-weight: semibold }` |
| `_q-toolbar.scss` | `MainLayout.vue` | `.q-toolbar { min-height: 64px }, .q-header { box-shadow }` |
| `_q-card.scss` | `CardComponent.vue` (новый) | `.q-card { border-radius, box-shadow, background, border }` |

После переноса — удалить папку `components/`.

### Шаг 4. Перенести layout-стили

`layouts/_main-layout.scss` содержит 4 класса:

| Класс | Куда перенести |
|-------|---------------|
| `.q-page.page-content` | Оставить в `app.scss` (глобальный layout, используется через PageComponent) |
| `.app-header` | `MainLayout.vue` `<style>` |
| `.app-logo` | `MainLayout.vue` `<style>` |
| `.sidebar-toggle` | `MainLayout.vue` `<style>` |

После переноса — удалить папку `layouts/`.

### Шаг 5. Очистить utilities/_helpers.scss

**Из ~70 классов используются только 2:**

| Класс | Где | Решение |
|-------|-----|---------|
| `border-lg` | ActivityLogExpandedRow.vue | Оставить в `app.scss` |
| `empty-state` | FeedPage.vue, SearchPage.vue | Перенести inline в компоненты (это просто flex-center для спиннера) или заменить на scoped стиль |

Удалить: все `bg-surface-*`, `rounded-*`, `border-sm/md`, `elevation-*`, `bg-action-*`, `badge-*`, `search-pill`, `line-clamp-*`, `.empty-state__text`.

После очистки — удалить папку `utilities/`.

### Шаг 6. Собрать финальный app.scss

Объединить оставшиеся глобальные стили в один файл с секциями:

```scss
/* ========================================
   RESET — глобальные базовые стили
   ======================================== */

*, *::before, *::after { box-sizing: border-box; }
body { ... }
img { ... }
a { ... }

/* ========================================
   LAYOUT — инфраструктурная разметка
   ======================================== */

.q-page.page-content {
  max-width: $page-max-width;
  margin-left: auto;
  margin-right: auto;
}

/* ========================================
   UTILITIES — вспомогательные классы
   ======================================== */

.border-lg { ... }
```

### Шаг 7. Обновить импорты

- `app.scss` — убрать все `@import`, т.к. всё будет в одном файле
- Удалить пустые папки: `base/`, `components/`, `layouts/`, `tokens/`, `utilities/`

---

## Файлы для замены q-card → CardComponent

После создания CardComponent, заменить в:
1. `entities/instagram-account/ui/ProfileCard.vue`
2. `widgets/activity-stats-cards/ui/ActivityStatsCards.vue`
3. `widgets/activity-grouped-stats/ui/ActivityGroupedStats.vue`
4. `pages/login/ui/LoginPage.vue`
5. `pages/llm-settings/ui/LlmSettingsPage.vue`

---

## Чеклист готовности

- [x] Шаг 1: CardComponent + CardSectionComponent + CardActionsComponent созданы
- [x] Шаг 1: q-card заменён на CardComponent во всех 5 файлах
- [x] Шаг 2: Удалены tokens/, _transitions.scss, _typography.scss
- [x] Шаг 3: Quasar overrides перенесены в 7 wrapper-компонентов
- [x] Шаг 3: Папка components/ удалена
- [x] Шаг 4: Layout-стили перенесены в MainLayout.vue
- [x] Шаг 4: Папка layouts/ удалена
- [x] Шаг 5: helpers.scss очищен (оставлен только border-lg)
- [x] Шаг 5: empty-state заменён на scoped loading-center в FeedPage и SearchPage
- [x] Шаг 5: Папка utilities/ удалена
- [x] Шаг 6: app.scss собран с секциями-комментариями
- [x] Шаг 7: Папка base/ удалена, все подпапки удалены
- [x] Финал: ESLint + vue-tsc — 0 ошибок
- [ ] Финал: Визуальная проверка в браузере
