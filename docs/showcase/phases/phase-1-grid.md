# Phase 1 — Read-only phone-simulator (профиль + сетка своих постов)

> Фундамент UI: показать СОБСТВЕННЫЙ профиль владельца (аватар, full_name, counts, bio) и его посты
> сеткой 3-в-ряд в «рамке телефона». Только чтение — никаких мутаций и overlay. Gate Phase 0 пройден.

## Объём

- Python: `POST /profile/info`, `POST /profile/medias` (+ `POST /media/info` для деталей поста).
- Laravel: `InstagramClientService::getOwnProfile/getOwnMedias/getMediaInfo`; `ShowcaseController::profile/medias`;
  роуты (#1,#2,#3 из `../api-contracts.md`). Overlay-мёрдж — пустой (дефолты), таблица overlay ещё не нужна
  (но `medias` уже отдаёт блок `overlay` с дефолтами, чтобы контракт не менялся в Phase 2).
- Vue: `entities/showcase-media` (`ShowcaseProfile`/`ShowcaseMedia` типы, DTO, `showcaseStore`);
  `widgets/phone-frame` (рамка + шапка профиля) и `widgets/showcase-grid` (3-в-ряд, reuse `MediaCard`);
  `pages/showcase/ShowcasePage.vue`; клик по посту → деталь (reuse `PostDetailModal`/`MediaDisplay`).
- Швы (оркестратор): роут `/showcase`, таб «Витрина», вложенный CLAUDE.md слайса.

## Механика

- Источник постов — `user_medias_paginated(cl.user_id)`, НЕ `/account/feed` (инвариант §2.2 архитектуры).
- `user_pk` владельца берётся из аккаунта (`/account/info` уже есть) или прямо в Python (`cl.user_id`).
- Сетка: 3 колонки, квадратные превью (как профиль IG), бейдж типа (видео/карусель), бейдж pinned.
  Для нередактируемого вида можно `MasonryGrid` или простой CSS-grid 3-кол (профиль IG — ровный grid,
  не masonry; рекомендация — ровный 3-кол grid для «рамки телефона»).
- Пагинация — по `next_cursor` (кнопка/инфинит-скролл), как в `feedStore`.
- `proxyImageUrl` на все картинки (IG CDN).

## Чек-лист

- [ ] Python endpoint'ы + Pydantic-модели; сериализация своих постов по выбранному в Phase 0 пути.
- [ ] Laravel сервис-методы (лог+detectStatus+maybeDeactivate) + контроллер (ownership) + роуты.
- [ ] FE entity (типы/DTO/store), `phone-frame`, `showcase-grid`, страница, деталь поста.
- [ ] `eslint --fix` + `vue-tsc --noEmit` чисто; BE/PY юнит-тесты по конвенциям слоёв.
- [ ] **Live-check:** реальный профиль + сетка грузятся, счётчики совпадают с приложением, пагинация работает.

## Критерий готовности (gate → Phase 2)

Свой профиль и сетка отображаются корректно на живом аккаунте, клик открывает деталь поста. Контракт
`medias` уже включает блок `overlay` (дефолты) — Phase 2 наполнит его, не меняя форму ответа.

## Делегирование (партиционировано по непересекающимся файлам)

- **Kiro Sonnet (max)** — Python endpoint'ы профиля/постов (тонкий прокси, низкий риск).
- **Kiro Opus (max)** — Laravel сервис/контроллер/контракт (точность ownership + формы ответа).
- **Kiro Sonnet (max)** — FE-слайс (entity + widgets + page) в своём worktree.
- Швы (роут/таб/CLAUDE.md) — оркестратор после слияния.
