# Задача 1: URL Query Parameters для страницы Search

## Цель

Синхронизировать состояние поиска с адресной строкой, чтобы:
- Копирование URL и открытие в новой вкладке воспроизводило тот же поиск (аккаунт, режим, хэштег/локация)
- Навигация назад в браузере сохраняла ленту без сброса
- `maxId` (курсор пагинации) НЕ попадал в URL — он бесполезен без предыдущих постов

## Текущее состояние

**Роут:** `/search` — без параметров (`routes.ts:29`)

**Состояние хранится в:**
- `searchStore` (Pinia) — `searchResults`, `searchCursor`, `lastHashtag`, `lastLocation`
- `useAccountSelect` — `selectedAccount` (localStorage ключ `search_selected_account_id`)
- Локальные ref в `SearchPage.vue` — `searchMode`, `hashtagInput`, `selectedLocation`

**Проблемы:**
- URL всегда `/search` — нет возможности поделиться ссылкой с контекстом
- При F5 (полная перезагрузка) состояние Pinia теряется, остаётся только `selectedAccount` из localStorage
- `lastHashtag` / `lastLocation` работают только при SPA-навигации (без перезагрузки)

## Целевые URL

```
/search?mode=hashtag&tag=travel&account=3
/search?mode=location&location_pk=12345&location_name=Moscow&account=3
/search   (без параметров — пустая страница)
```

## Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|-------------|----------|
| `mode` | `hashtag` \| `location` | нет (default: `hashtag`) | Режим поиска |
| `tag` | string | нет | Хэштег (без `#`) |
| `account` | number | нет | ID аккаунта в системе |
| `location_pk` | number | нет | PK геолокации Instagram |
| `location_name` | string | нет | Название локации (для отображения в select без повторного запроса) |

## Реализация

### Шаг 1: Обновить роут

**Файл:** `frontend-vue/src/router/routes.ts`

Роут остаётся тот же (`path: 'search'`), query-параметры не требуют изменения конфигурации роутера — Vue Router их обрабатывает автоматически через `useRoute().query`.

Добавить `name: 'search'` для удобного программного перехода:

```typescript
{
  path: 'search',
  name: 'search',
  component: () => import('@/pages/search/ui/SearchPage.vue')
}
```

### Шаг 2: Синхронизация URL → State (при загрузке)

**Файл:** `frontend-vue/src/pages/search/ui/SearchPage.vue`

В `onMounted` после `initAccounts()`:
1. Прочитать `route.query`
2. Если есть `account` — найти аккаунт по ID и установить в `selectedAccount`
3. Если `mode=hashtag` и есть `tag` — установить `hashtagInput`, вызвать `searchHashtagHandler()`
4. Если `mode=location` и есть `location_pk` + `location_name` — создать объект `Location`, установить `selectedLocation`, вызвать `selectLocationHandler()`
5. Если query пуст — восстановить из store как сейчас (fallback для навигации назад)

```typescript
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  void initAccounts().then(() => {
    const { mode, tag, account, location_pk, location_name } = route.query

    // Установить аккаунт из URL (если указан)
    if (account) {
      const acc = accountStore.accounts.find(
        (a) => a.id === Number(account)
      )
      acc && (selectedAccount.value = acc)
    }

    // Инициализировать поиск из URL
    if (mode === 'location' && location_pk && location_name) {
      searchMode.value = 'location'
      selectedLocation.value = {
        pk: Number(location_pk),
        name: String(location_name),
        address: '',
        lat: 0,
        lng: 0
      }
      selectedAccount.value && selectLocationHandler(selectedLocation.value)
    } else if (tag) {
      searchMode.value = 'hashtag'
      hashtagInput.value = String(tag)
      selectedAccount.value && searchHashtagHandler()
    } else {
      // Fallback: восстановление из store (SPA-навигация назад)
      if (searchStore.lastHashtag) {
        hashtagInput.value = searchStore.lastHashtag
        searchMode.value = 'hashtag'
      } else if (searchStore.lastLocation) {
        selectedLocation.value = searchStore.lastLocation
        searchMode.value = 'location'
      }
    }
  })
})
```

### Шаг 3: Синхронизация State → URL (при действиях)

**Файл:** `frontend-vue/src/pages/search/ui/SearchPage.vue`

Создать хелпер `syncQueryParams()`, который вызывается после каждого поиска:

```typescript
const syncQueryParams = () => {
  const query: Record<string, string> = {}

  selectedAccount.value && (query.account = String(selectedAccount.value.id))

  if (searchMode.value === 'hashtag' && hashtagInput.value.trim()) {
    query.mode = 'hashtag'
    query.tag = hashtagInput.value.trim().replace(/^#/, '')
  } else if (searchMode.value === 'location' && selectedLocation.value) {
    query.mode = 'location'
    query.location_pk = String(selectedLocation.value.pk)
    query.location_name = selectedLocation.value.name
  }

  router.replace({ query })
}
```

Вызывать `syncQueryParams()`:
- В `searchHashtagHandler()` — после `searchStore.searchHashtag()`
- В `selectLocationHandler()` — после `searchStore.fetchLocationMedias()`
- При смене аккаунта (watch на `selectedAccount`)
- В `resetSearch()` — очистить query
- В `switchModeHandler()` — очистить query

Важно: использовать `router.replace()` (не `router.push()`), чтобы не засорять историю каждым поиском.

### Шаг 4: Сохранение ленты при навигации назад

Текущая логика уже работает: `searchStore.searchResults` хранится в Pinia и не очищается при уходе со страницы. При возврате через браузерную кнопку «Назад» — компонент монтируется заново, `onMounted` проверяет `route.query`:

- Если query есть (URL был синхронизирован) — НЕ запускать повторный поиск, если `searchStore.searchResults` уже заполнен и `lastHashtag`/`lastLocation` совпадают
- Добавить проверку: `if (searchStore.searchResults.length > 0 && searchStore.lastHashtag === tag) return` — пропустить поиск, восстановить только UI-состояние

### Шаг 5: Watch на смену аккаунта

При смене аккаунта в select — сбросить результаты и обновить URL:

```typescript
watch(selectedAccount, () => {
  searchStore.clearResults()
  syncQueryParams()
})
```

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `frontend-vue/src/router/routes.ts` | Добавить `name: 'search'` |
| `frontend-vue/src/pages/search/ui/SearchPage.vue` | Логика синхронизации URL ↔ State |

## Тестирование

1. Открыть `/search`, выполнить поиск по хэштегу → URL обновился
2. Скопировать URL, открыть в новой вкладке → поиск воспроизвёлся
3. Перейти на `/logs`, нажать «Назад» → лента сохранилась, кнопка «Загрузить ещё» работает
4. Выполнить поиск по локации → URL содержит `location_pk` и `location_name`
5. Сменить аккаунт → URL обновился, результаты сброшены
6. F5 на странице с параметрами → поиск выполнился заново

### Через Debug Port (CDP)

```javascript
// Проверить текущий URL
location.href

// Проверить query params
new URLSearchParams(location.search).toString()

// Проверить состояние store
document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  .state.value.search
```
