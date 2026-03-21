# Search & Post Detail — План задач

## Обзор

Четыре задачи по улучшению страницы поиска и модального окна поста. Задачи независимы друг от друга, но имеют общие точки (PostDetailModal, searchStore, Python-сервис).

---

## Задачи

### 1. URL Query Parameters для страницы Search
**Файл:** [01-search-query-params.md](01-search-query-params.md)

Синхронизация состояния поиска с адресной строкой через GET-параметры. При копировании URL и открытии в новой вкладке — поиск воспроизводится автоматически. При навигации назад в браузере — лента сохраняется.

**Параметры в URL:**
- `mode` — `hashtag` | `location`
- `tag` — название хэштега (без `#`)
- `account` — ID аккаунта Instagram
- `location_pk` — PK геолокации
- `location_name` — название геолокации (для отображения)

**Что НЕ в URL:** `maxId` (курсор пагинации) — остаётся в store, т.к. курсор без предыдущих страниц бесполезен.

**Слои:** Frontend (router, SearchPage, searchStore).

---

### 2. Кликабельные хэштеги в PostDetailModal
**Файл:** [02-clickable-hashtags.md](02-clickable-hashtags.md)

Парсинг `#хэштегов` в описании поста (captionText) и преобразование их в ссылки. Клик → переход на `/search?mode=hashtag&tag=NAME&account=ID` (в новой вкладке или в текущей, в зависимости от способа клика).

**Контекст аккаунта:** берётся из пропса `accountId`, который уже передаётся в PostDetailModal.

**Слои:** Frontend (PostDetailModal, shared-компонент для рендеринга caption).

---

### 3. Кликабельная геолокация в PostDetailModal
**Файл:** [03-clickable-geolocation.md](03-clickable-geolocation.md)

Клик по названию геолокации в посте → переход на `/search?mode=location&location_pk=PK&location_name=NAME&account=ID`. Для этого необходимо добавить `location_pk` в данные поста на всех уровнях (Python → Laravel → Frontend).

**Слои:** Python (_serialize_media), Laravel (проброс), Frontend (типы, DTO, PostDetailModal).

---

### 4. Загрузка и отображение комментариев в PostDetailModal
**Файл:** [04-post-comments.md](04-post-comments.md)

При открытии поста — загрузка существующих комментариев (минимум 15) и отображение их в правой панели. Поддержка вложенных комментариев (replies) и кнопка «Загрузить ещё».

**Слои:** Python (новый endpoint), Laravel (controller + service), Frontend (типы, store, UI-компонент).

---

## Порядок реализации (рекомендуемый)

1. **Задача 1** — URL Query Params (фундамент, от неё зависят задачи 2 и 3)
2. **Задача 3** — Кликабельная геолокация (требует изменения Python → Laravel → Frontend, добавляет `location_pk`)
3. **Задача 2** — Кликабельные хэштеги (только Frontend, использует роут из задачи 1)
4. **Задача 4** — Комментарии (самая объёмная, полностью независима от 2 и 3)

## Инструменты отладки

Все задачи тестируются по [DEBUG_PROTOCOL.md](../DEBUG_PROTOCOL.md):
- Python raw: `curl` к `localhost:8001`
- Laravel Tinker: вызов сервисов напрямую
- Laravel HTTP: `curl` с Bearer-токеном к `localhost:8000`
- Browser Debug Port: проверка фронтенда через CDP
