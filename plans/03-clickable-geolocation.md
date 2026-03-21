# Задача 3: Кликабельная геолокация в PostDetailModal

## Цель

Клик по названию геолокации в посте → открытие `/search?mode=location&location_pk=PK&location_name=NAME&account=ID` в новой вкладке. Для этого необходимо добавить `location_pk` в данные поста — сейчас передаётся только `location_name`.

## Текущее состояние

### Python (`helpers.py:123-146`)

`_serialize_media()` извлекает из Instagram API:
```python
location = media_dict.get("location") or {}
# ...
"location_name": location.get("name") if isinstance(location, dict) else None,
```

`location_pk` **не извлекается**, хотя доступен в raw-данных Instagram (`location.pk`).

### Frontend

**Типы (`types.ts`):**
```typescript
// MediaPost
locationName: Nullable<string>  // ← только имя, pk нет
```

**PostDetailModal (`PostDetailModal.vue:119-121`):**
```html
<span v-if="post.locationName">
  <q-icon name="location_on" size="14px" />
  {{ post.locationName }}
</span>
```

Геолокация отображается как текст — не кликабельна.

## Реализация

### Шаг 1: Python — добавить `location_pk`

**Файл:** `python-service/helpers.py`

В функции `_serialize_media()` добавить `location_pk`:

```python
location = media_dict.get("location") or {}

return {
    # ... существующие поля ...
    "location_name": location.get("name") if isinstance(location, dict) else None,
    "location_pk": location.get("pk") if isinstance(location, dict) else None,  # NEW
    # ...
}
```

> **Важно:** В Instagram API поле `location.pk` — числовой ID геолокации. Это тот же `pk`, который используется в `/search/location?location_pk=...`. Проверить через DEBUG_PROTOCOL: отправить raw-запрос к Python `/search/hashtag`, посмотреть `location.pk` в сырых данных.

### Шаг 2: Laravel — проброс (ничего не делать)

`SearchController` и `InstagramClientService` возвращают raw JSON от Python без трансформации полей медиа. Поле `location_pk` пройдёт насквозь автоматически.

**Проверка:** После изменения Python — отправить запрос через DEBUG_PROTOCOL (шаг 3 — Laravel HTTP) и убедиться, что `location_pk` присутствует в ответе.

### Шаг 3: Frontend — типы

**Файл:** `frontend-vue/src/entities/media-post/model/apiTypes.ts`

Добавить в `MediaPostApi`:
```typescript
location_pk: Nullable<number>
```

**Файл:** `frontend-vue/src/entities/media-post/model/types.ts`

Добавить в `MediaPost`:
```typescript
locationPk: Nullable<number>
```

### Шаг 4: Frontend — DTO

**Файл:** `frontend-vue/src/entities/media-post/model/mediaPostDTO.ts`

В `toLocalPost()` добавить:
```typescript
locationPk: data.location_pk,
```

### Шаг 5: PostDetailModal — кликабельная геолокация

**Файл:** `frontend-vue/src/features/post-detail/ui/PostDetailModal.vue`

Заменить текущий блок геолокации:
```html
<span v-if="post.locationName">
  <q-icon name="location_on" size="14px" />
  {{ post.locationName }}
</span>
```

На кликабельную версию:
```html
<a
  v-if="post.locationName"
  class="location-link"
  :href="buildLocationUrl()"
  target="_blank"
  @click.prevent="navigateToLocation"
>
  <q-icon name="location_on" size="14px" />
  {{ post.locationName }}
</a>
<span v-else-if="post.locationName">
  <q-icon name="location_on" size="14px" />
  {{ post.locationName }}
</span>
```

Логика: если есть `locationPk` — ссылка кликабельна, если только `locationName` без pk — обычный текст.

Упрощённый вариант (всегда ссылка, если есть pk):
```html
<component
  :is="post.locationPk ? 'a' : 'span'"
  v-if="post.locationName"
  v-bind="post.locationPk ? {
    href: buildLocationUrl(),
    target: '_blank',
    class: 'location-link'
  } : {}"
  @click="post.locationPk && navigateToLocation($event)"
>
  <q-icon name="location_on" size="14px" />
  {{ post.locationName }}
</component>
```

**Методы:**
```typescript
const buildLocationUrl = (): string => {
  const params = new URLSearchParams({
    mode: 'location',
    location_pk: String(props.post.locationPk),
    location_name: props.post.locationName!
  })
  props.accountId && params.set('account', String(props.accountId))
  return `/search?${params.toString()}`
}

const navigateToLocation = (event: Event) => {
  event.preventDefault()
  window.open(buildLocationUrl(), '_blank')
}
```

**Стили:**
```scss
.location-link {
  color: $content-secondary;
  text-decoration: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;

  &:hover {
    color: $primary;
    text-decoration: underline;
  }
}
```

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `python-service/helpers.py` | Добавить `location_pk` в `_serialize_media()` |
| `frontend-vue/src/entities/media-post/model/apiTypes.ts` | Добавить `location_pk` в `MediaPostApi` |
| `frontend-vue/src/entities/media-post/model/types.ts` | Добавить `locationPk` в `MediaPost` |
| `frontend-vue/src/entities/media-post/model/mediaPostDTO.ts` | Добавить маппинг `locationPk` |
| `frontend-vue/src/features/post-detail/ui/PostDetailModal.vue` | Кликабельная геолокация |

## Зависимости

- **Задача 1** должна быть выполнена первой — URL `/search?mode=location&...` должен обрабатываться

## Верификация данных (DEBUG_PROTOCOL)

### 1. Проверить наличие `location.pk` в raw данных Instagram

```bash
# Шаг 1: получить session.json (если нет)
docker compose exec -T laravel php artisan tinker <<'TINKER'
$a = \App\Models\InstagramAccount::find(3);
file_put_contents(base_path("session_3.json"), json_encode(json_decode($a->session_data, true), JSON_PRETTY_PRINT));
echo "OK";
TINKER
cp backend-laravel/session_3.json _TEST/session.json

# Шаг 2: raw Python запрос (хэштег)
jq -n --arg sd "$(cat _TEST/session.json)" \
  '{session_data: $sd, hashtag: "travel", amount: 5}' | \
curl -s -X POST http://localhost:8001/search/hashtag \
  -H "Content-Type: application/json" \
  -d @- | jq '.items[0].location_pk' > /dev/null

# Если null — значит поле location_pk ещё не добавлено в _serialize_media
# Если число — данные доступны
```

### 2. После изменения Python — проверить полный стек

```bash
# Python raw
jq -n --arg sd "$(cat _TEST/session.json)" \
  '{session_data: $sd, hashtag: "travel", amount: 5}' | \
curl -s -X POST http://localhost:8001/search/hashtag \
  -H "Content-Type: application/json" \
  -d @- | jq '[.items[] | {location_name, location_pk}]'

# Laravel HTTP
curl -s "http://localhost:8000/api/search/hashtag?account_id=3&tag=travel&amount=5" \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" \
  | jq '[.data.items[] | {location_name, location_pk}]'
```

## Тестирование

1. Открыть пост с геолокацией → название кликабельное, стилизовано
2. Hover → подчёркивание, смена цвета
3. Клик → новая вкладка с поиском по этой геолокации
4. Пост без геолокации → блок не отображается (как было)
5. Пост с `locationName` но без `locationPk` (маловероятно, но возможно) → текст без ссылки
