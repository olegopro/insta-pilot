# Frontend — Vue 3 + Quasar + TypeScript

> **Императивные правила для `frontend-vue/`.** Глобальный контекст и карта документации — в [`../CLAUDE.md`](../CLAUDE.md).

## Документация
- Vue 3: Context7 library ID: `/vuejs/docs`
- Quasar: Context7 library ID: `/quasarframework/quasar`
- FSD: Context7 library ID: `/feature-sliced/documentation`

## Архитектура: FSD (Feature-Sliced Design)
Документация: https://feature-sliced.design/docs

## Правила
- Порядок блоков SFC: `<script setup lang="ts">` → `<template>` → `<style>`
- Импорты: через `@/` (не `./` или `../`)
- Обработчики событий: суффикс `Handler` (`submitHandler`)
- UI компоненты: только кастомные обёртки из `shared/ui/` (ButtonComponent, InputComponent, SelectComponent, ToggleComponent, ...) над Quasar, суффикс `Component`
- Каждый action в store — через `useApi`, никакого внутреннего state в store
- Public API слайсов — через `index.ts` в каждом сегменте
- Стиль кода: стрелочные функции без `{}` если тело — один expression (`.catch(() => Notify.create(...))`); enforced ESLint-правилом `local/arrow-concise-body` с autofix
- Стиль кода: параметры callback-ов — только полные имена, без однобуквенных сокращений (`.then((response) => response.data)`, `.find((account) => account.id === id)`, не `r`, `a`, `e` и т.п.)`
- Стиль кода: `&&` вместо `if` для коротких условных вызовов (`opened && fn()`)
- Стиль кода: хуки жизненного цикла (`onMounted`, `onBeforeUnmount` и др.) размещать в самом конце `<script setup>`, после всех переменных, computed и watch — ESLint это не проверяет, соглашение проекта
- Шаблоны: никогда не добавлять `.value` — Vue автоматически разворачивает `Ref` в `<template>`
- Уведомления: использовать `notifyError` / `notifySuccess` из `@/shared/lib`, а не `Notify.create` напрямую
- Trailing comma в объектах не ставится: `{ a: 1, b: 2 }`, не `{ a: 1, b: 2, }`; правило распространяется и на объект с одним свойством: `{ a: 1 }`, не `{ a: 1, }`
- Валидация форм: правила выносить в переменные в `<script setup>`, не писать функции прямо в `:rules`; все переиспользуемые валидаторы — в `shared/lib/validators.ts` (реэкспорт через `shared/lib/index.ts`); для email использовать `patterns.testPattern.email` из `quasar`, не `type="email"`

## Обёртки над Quasar-компонентами (shared/ui)

Паттерн каждого wrapper-компонента (`shared/ui/*/`):
- `interface XxxComponentProps extends Omit<QXxxProps, 'modelValue'>` + `defineProps<XxxComponentProps>()`
- `useForwardProps(props)` из `@/shared/lib` — фильтрует `undefined` для корректного проброса пропсов
- `defineOptions({ inheritAttrs: false })` + `v-bind="{ ...$attrs, ...forwarded }"` на корневом элементе
- `defineModel` для двустороннего бинда
- Слоты: proxy через `v-for` по `$slots`
- `export interface XxxComponentProps` + реэкспорт через `index.ts` сегмента
- Компоненты с required-пропсами (QTable, QTree и др.) — нужен cast: `v-bind="{ ...$attrs, ...(forwarded as QXxxProps) }"` (см. JSDoc в `useForwardProps.ts`)

Примеры: `shared/ui/input-component/` (без cast), `shared/ui/table-component/` (с cast)

## Типы и DTO
- API типы (snake_case от бэкенда): суффикс `Api` — `MediaPostApi`, `FeedResponseApi`. Файл: `apiTypes.ts`
- Локальные типы (camelCase): без суффикса — `MediaPost`, `InstagramUserDetail`. Файл: `types.ts`
- DTO: класс-синглтон с `toLocal()` / `toLocalPost()`. Файл: `*DTO.ts`, экспорт: `export default new ClassName()`
- `Nullable<T>` из `@/shared/lib` вместо `T | null`

## Паттерн таблиц (QTable)
Всегда использовать `TableComponent` из `@/shared/ui/table-component` вместо `q-table` напрямую.
Для каждой сущности с таблицей создавать два файла в `entities/*/model/`:
- `*TableColumns.ts` — колонки + `RowModel` интерфейс (`satisfies QTableColumn<RowModel>[]`)
- `*ListDTO.ts` — маппинг API-модели (snake_case) → RowModel (camelCase), класс + singleton

Страница/виджет с таблицей использует:
```ts
const { columns, columnsVisibleNames } = useFilterColumns(*TableColumns)
const { searchText } = useSearchQuery()
const rows = computed(() => *ListDTO.toLocal(store.someApi.data?.data ?? []))
```
Пример: [InstagramAccountsList.vue](src/widgets/instagram-accounts-list/ui/InstagramAccountsList.vue)

## Структура src/ (FSD)
```
boot/                    # Quasar boot (не трогать расположение)
  axios.ts               # axios instance + globalProperties
router/                  # Quasar router (не трогать расположение)
  index.ts               # createRouter + Router.beforeEach(authGuard)
  guard.ts               # authGuard — навигационный guard (вынесен из index.ts ради unit-тестов)
layouts/                 # MainLayout

shared/
  api/                   # useApi, ApiResponseWrapper
  lib/                   # Nullable, notify, formatters, echo, useModal, useFilterColumns,
                         # useSearchQuery, useForwardProps, validators, proxyImageUrl,
                         # useReverseInfiniteScroll
  ui/
    button-component/    # каждый компонент — своя папка (kebab-case) + index.ts
    input-component/
    modal-component/
    select-component/
    toggle-component/
    table-component/
    table-tools-wrapper/
    masonry-grid/        # CSS columns Masonry
    media-card/          # Карточка поста (thumbnail + overlay)
    media-display/       # Фото/видео/карусель (Swiper.js)

entities/
  instagram-account/     # InstagramAccount, accountStore, ProfileCard
  media-post/            # MediaPost, feedStore, searchStore, MEDIA_TYPE constants
  llm-settings/          # LlmSetting, llmSettingsStore, LLM_PROVIDERS/MODELS constants
  user/                  # User, authStore, token management
  activity-log/          # AccountActivityLog, activityLogStore, sidebarActivityStore,
                         # activityLogTableColumns, activitySummaryTableColumns,
                         # activityLogListDTO, activitySummaryListDTO, apiTypes, types, constants

features/
  add-instagram-account/ # Добавление аккаунта
  delete-instagram-account/
  view-instagram-account/
  auth-login/            # Форма логина
  post-detail/           # PostDetailModal (фото/видео, комментарии, лайки)
  instagram-user/        # InstagramUserModal (профиль пользователя)
  generate-comment/      # useCommentGeneration (WebSocket), GenerationStatus
  activity-filter/       # Фильтрация логов (аккаунт, действие, статус, дата)
  activity-live/         # WebSocket-подписка на ActivityLogCreated

widgets/
  instagram-accounts-list/  # Таблица аккаунтов
  activity-log-table/       # Таблица логов (с разворотом строки, reverse-scroll)
  activity-sidebar/         # Боковая панель с деталями записи лога
  activity-stats-cards/     # Карточки сводной статистики
  activity-summary-table/   # Таблица сводки по действиям
  activity-grouped-stats/   # Сгруппированная статистика

pages/
  login/                 # LoginPage
  instagram-accounts/    # InstagramAccountsPage
  feed/                  # FeedPage (Masonry-лента)
  search/                # SearchPage (хэштеги/гео + комментарии)
  llm-settings/          # LlmSettingsPage (admin)
  admin-users/           # AdminUsersPage (admin)
  logs/                  # LogsPage (мониторинг активности, Phase 5)
```

## Нейминг
- `instagram-account` — Instagram аккаунт в системе
- `user` — пользователь системы insta-pilot (Sanctum auth + Spatie roles: admin/user)
- `media-post` — публикация Instagram (фото/видео/карусель)
- `llm-settings` — настройки LLM-провайдера (GLM / OpenAI)
- `activity-log` — запись лога активности аккаунта (`account_activity_logs`)
- `device-profile` — профиль устройства Android для инстаграм-клиента

## Pinia и .value
- В компоненте через `store.someProperty`: `.value` НЕ нужно — Pinia применяет `UnwrapRef` рекурсивно
- Правило: `store.*.value` в компоненте — это ошибка TS

## Паттерн store: нейминг и структура
```ts
// ПРИВАТНЫЕ useApi-объекты (суффикс Api, не в return):
const fetchAccountsApi = useApi(...)
const deleteAccountApi = useApi(...)

// ПУБЛИЧНЫЕ ref-данные (существительное):
const accounts = ref<InstagramAccount[]>([])

// ПУБЛИЧНЫЕ actions — всегда императивный паттерн:
const fetchAccounts = async () => {
  const { data } = await fetchAccountsApi.execute()
  accounts.value = data
}
const fetchAccountsLoading = computed(() => fetchAccountsApi.loading.value)

// Если action не работает с данными ответа — fire-and-forget:
const deleteAccount = (id: number) => deleteAccountApi.execute(id)
const deleteAccountLoading = computed(() => deleteAccountApi.loading.value)
const deleteAccountError = computed(() => deleteAccountApi.error.value)

// return — только публичное, никаких *Api:
return { accounts, fetchAccounts, fetchAccountsLoading, ... }
```
- `*Api`-объекты никогда не выставляются наружу через return
- Данные всегда в `ref`, не в `computed(() => api.response.value?.data)`
- `execute()` возвращает `Promise<TData>` — данные получаем через `const { data } = await execute()`
- При ошибке `execute()` ставит `error.value` и пробрасывает throw — код после `await` не выполнится
- Не использовать `if (!data) return` после `await execute()` — ошибки уже обработаны через throw

## useReverseInfiniteScroll
Хук `shared/lib/useReverseInfiniteScroll.ts` — загрузка старых записей при скролле вверх.
- Слушает `window.scroll` (не контейнер)
- При `scrollY < 100` вызывает `loadOlderFn()`, затем восстанавливает позицию скролла через `window.scrollTo`
- Восстановление только если `addedHeight > 0` (предотвращает jitter)
- Вызывающий компонент обязан навешивать throttle (150 мс) самостоятельно

## Паттерн activity-log-table
- `ActivityLogTable` использует window scroll + `useReverseInfiniteScroll` для пагинации вверх
- Клик по строке таблицы разворачивает `ActivityLogExpandedRow` (без отдельной кнопки expand)
- `ActivityLogExpandedRow` показывает 3 секции: Vue↔Laravel / Laravel↔Python / Python↔Instagram
- Секции Vue↔Laravel и Python↔Instagram имеют вкладки Кратко/Подробно — только если данные содержат объекты/массивы (`hasNestedData`)
- Секция Laravel↔Python — всегда без вкладок (данные скалярные)
- Поля `*_preview` в response отображаются с иконкой ⓘ и tooltip о том, что это сокращённые данные

## Тесты (конвенции) — frontend
Запуск (в контейнерах): FE unit — `docker compose exec vue npx vitest run`; FE integration — `... vitest run --config vitest.integration.config.ts` (нужен живой laravel; иначе авто-skip); FE e2e — `... npx playwright test`.
- **Авторитет покрытия по слоям, без дублей** (кросс-слойное правило): маппинг snake↔camel — только в `*DTO.spec` (store-тесты доказывают лишь запись в `ref`); дефолт `loading`/throw/`error.value` — только в `useApi.spec` (не повторять в каждом сторе).
- **Параметризация однотипных кейсов**: FE — `it.each([...])`.
- **Не писать тавтологии**: не тестировать реактивность голого `ref`, `toBeDefined`/`toBeTruthy` без поведенческой проверки.
- **Навигационный guard** тестируется через `authGuard` из `router/guard.ts` (реальная функция), а не через копию логики в тестовом роутере.
- Ручные проверки с живым Instagram-аккаунтом (бывшие `@group instagram`-заглушки) вынесены в чек-лист `DEBUG_PROTOCOL.md`, а не висят пустыми `markTestSkipped`.

## Отладка ошибок

### Где смотреть ошибки
- Ошибки видны в IDE (Volar + ESLint), при сборке `quasar build`, и вручную.
- Логи контейнера: `docker compose logs vue` или `docker compose logs -f vue`
- Ручная проверка TS: `docker compose exec vue npx vue-tsc --noEmit`

### Красный overlay ошибок в браузере (dev) — ВЫКЛЮЧЕН по умолчанию
Это «оверлей Vue с красными ошибками» = `vite-plugin-checker` (vueTsc + typed ESLint).
Он держит TS-программу в памяти (~1 ГБ на dev-контейнер), поэтому в dev отключён.
- **Включить overlay обратно**: запустить dev с `CHECK=1`, напр. внутри контейнера
  `CHECK=1 npx quasar dev --hostname 0.0.0.0` (или поменять command vue в docker-compose на `CHECK=1 ...`).
- Гейт в `frontend-vue/quasar.config.ts`: `ctx.prod || process.env.CHECK`. При сборке всегда включён.
- Если пользователь просит «включи оверлей с ошибками Vue / красные ошибки в браузере» — речь про это (`CHECK=1`).

### Workflow после реализации задачи
1. Сначала запустить ESLint autofix: `docker compose exec vue npx eslint --fix ./src`
2. Проверить оставшиеся TS ошибки: `docker compose exec vue npx vue-tsc --noEmit`
3. Исправлять вручную только то, что autofix не решил

## Связанные документы
- [`../documentation/01-realtime-websocket.md`](../documentation/01-realtime-websocket.md) — WebSocket на фронте.
- [`../documentation/02-llm-generation.md`](../documentation/02-llm-generation.md) — UI генерации.
- [`../documentation/03-pinia-store-pattern.md`](../documentation/03-pinia-store-pattern.md) — детальный паттерн Pinia-стора.
- [`../AUTOMATION-ARCHITECTURE.md`](../AUTOMATION-ARCHITECTURE.md) — контракт фронта с движком автоматизации.
