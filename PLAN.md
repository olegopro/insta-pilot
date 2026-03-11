# insta-pilot — Master Plan

## Обзор

Админ-панель для управления Instagram-аккаунтами:
- Управление аккаунтами (CRUD) ✅
- Авторизация пользователей с ролями (admin / user)
- Лента Instagram-аккаунта (Masonry + лайки + инфо)
- Поиск по хэштегам / геолокации + генерация AI-комментариев
- Настройки LLM-провайдера

---

## Страницы

| # | Страница | Роут | Доступ | Описание |
|---|----------|------|--------|----------|
| 0 | Логин | `/login` | public | Вход в систему |
| 1 | Аккаунты | `/accounts` | auth | CRUD Instagram-аккаунтов ✅ |
| 2 | Лента | `/feed` | auth | Masonry-лента, лайки, инфо о пользователе |
| 3 | Поиск | `/search` | auth | Хэштеги / гео, модалка поста, комментарии |
| 4 | Настройки LLM | `/settings/llm` | admin | API key, модель, промпт, тон |
| 5 | Пользователи | `/admin/users` | admin | Таблица, роли, активация |

---

## Нейминг

| Термин | Описание |
|--------|----------|
| `user` | Пользователь системы insta-pilot |
| `instagram-account` | Instagram-аккаунт, добавленный в систему |
| `media-post` | Публикация Instagram (фото/видео/альбом) |
| `llm-settings` | Настройки LLM-провайдера |

---

## Фазы реализации

### Фаза 0 — Основа ✅

- [✅] FSD структура, shared/api, shared/lib, shared/ui
- [✅] entities/instagram-account (типы, store, ProfileCard)
- [✅] Страница аккаунтов (таблица, CRUD, модалки)
- [✅] Backend: Controller, Repository, Service, миграция
- [✅] Python: `/auth/login`, `/account/info`

---

### Фаза 1 — Авторизация и пользователи

> [Backend →](PLAN-EXTEND-BACK.md#фаза-1--авторизация-и-пользователи) | [Frontend →](PLAN-EXTEND-FRONT.md#фаза-1--авторизация-и-пользователи)

**Backend:**
- [ ] 1.1 Laravel Sanctum (SPA auth, token-based)
- [ ] 1.2 Spatie/laravel-permission (роли: admin, user)
- [ ] 1.3 Миграции: `is_active` для users, `user_id` для instagram_accounts
- [ ] 1.4 AuthController (register, login, logout, me)
- [ ] 1.5 EnsureUserIsActive middleware
- [ ] 1.6 UserController (admin: список, toggle active, смена роли)
- [ ] 1.7 Обновить InstagramAccountController (фильтрация по user_id)
- [ ] 1.8 AdminSeeder (admin user + roles)

**Frontend:**
- [ ] 1.9 entities/user (типы, authStore, token management)
- [ ] 1.10 Axios interceptor (Bearer token, 401 → redirect)
- [ ] 1.11 Страница логина (LoginPage)
- [ ] 1.12 Auth guard в роутере (auth, guest, role)
- [ ] 1.13 Страница пользователей (AdminUsersPage)
- [ ] 1.14 MainLayout: навигация с учётом ролей + logout

---

### Фаза 2 — Лента аккаунта

> [Backend →](PLAN-EXTEND-BACK.md#фаза-2--лента-аккаунта) | [Frontend →](PLAN-EXTEND-FRONT.md#фаза-2--лента-аккаунта)

**Python:**
- [ ] 2.1 `POST /account/feed` (таймлайн + пагинация через max_id)
- [ ] 2.2 `POST /user/info` (детали пользователя по pk)

**Laravel:**
- [ ] 2.3 FeedController (лента + лайк)
- [ ] 2.4 InstagramUserController (инфо о пользователе)
- [ ] 2.5 Обновить InstagramClientService (getFeed, getUserInfoByPk, likeMedia)

**Frontend:**
- [ ] 2.6 shared/ui: MasonryGrid (CSS columns, 3 колонки)
- [ ] 2.7 shared/ui: MediaCard (thumbnail + hover overlay с лайком и инфо)
- [ ] 2.8 entities/media-post (типы MediaPost, MediaUser, InstagramUserDetail)
- [ ] 2.9 feedStore (Pinia: fetchFeed, likePost, fetchUserInfo)
- [ ] 2.10 Страница ленты (FeedPage: выбор аккаунта + Masonry + QInfiniteScroll)
- [ ] 2.11 Модалка поста (PostDetailModal: фото/видео, caption, статистика)
- [ ] 2.12 Модалка пользователя (InstagramUserModal: аватар, bio, подписчики)

---

### Фаза 3 — Поиск по тегам/гео + комментарии

> [Backend →](PLAN-EXTEND-BACK.md#фаза-3--поиск-по-тегамгео) | [Frontend →](PLAN-EXTEND-FRONT.md#фаза-3--поиск-по-тегамгео)

**Python:**
- [ ] 3.1 `POST /search/hashtag` (медиа по хэштегу)
- [ ] 3.2 `POST /search/locations` (поиск мест по названию)
- [ ] 3.3 `POST /search/location` (медиа по локации)
- [ ] 3.4 `POST /media/comment` (отправка комментария)

**Laravel:**
- [ ] 3.5 SearchController (хэштег, локации, медиа по локации)
- [ ] 3.6 CommentController (отправка комментария)
- [ ] 3.7 Обновить InstagramClientService (searchHashtag, searchLocations, searchLocationMedias, commentMedia)

**Frontend:**
- [ ] 3.8 Страница поиска (SearchPage: toggle хэштег/гео, поле ввода)
- [ ] 3.9 Masonry с результатами (переиспользование MasonryGrid + MediaCard)
- [ ] 3.10 Модалка поста с комментарием (SearchPostModal: автор, контент, статистика, ввод)
- [ ] 3.11 Кнопки "Сгенерировать" + "Отправить" (UI готов, генерация → Фаза 4)
- [ ] 3.12 searchStore (Pinia: searchHashtag, searchLocations, searchLocation, sendComment)

---

### Фаза 4 — LLM интеграция (настройки + генерация + WebSocket)

> [Backend →](PLAN-EXTEND-BACK.md#фаза-4--llm-интеграция) | [Frontend →](PLAN-EXTEND-FRONT.md#фаза-4--llm-интеграция)

**Laravel:**
- [ ] 4.1 LlmSetting модель + миграция (provider, api_key, model_name, system_prompt, tone)
- [ ] 4.2 LlmSettingsController (show, update, testConnection)
- [ ] 4.3 LlmService (z.ai API: скачать изображение → отправить с промптом)
- [ ] 4.4 GenerateCommentJob (queue: download → LLM → broadcast result)
- [ ] 4.5 CommentGenerationProgress event (ShouldBroadcast)
- [ ] 4.6 CommentGenerateController (`POST /api/comments/generate` → dispatch job)
- [ ] 4.7 Laravel Reverb (WebSocket сервер, `php artisan install:broadcasting`)
- [ ] 4.8 Docker: reverb + queue-worker сервисы

**Frontend:**
- [ ] 4.9 entities/llm-settings (типы, llmSettingsStore)
- [ ] 4.10 Страница настроек LLM (LlmSettingsPage: форма + тест)
- [ ] 4.11 shared/lib/useEcho (Laravel Echo + pusher-js инициализация)
- [ ] 4.12 features/generate-comment: useCommentGeneration composable (WebSocket + статус)
- [ ] 4.13 Блок статуса генерации в SearchPostModal (QTimeline/stepper)
- [ ] 4.14 Вставка сгенерированного комментария в поле ввода

---

## Архитектурные решения

| Решение | Технология | Причина |
|---------|-----------|---------|
| Auth | Laravel Sanctum | SPA-friendly, встроен в Laravel, token-based |
| Roles | Spatie/laravel-permission | Стандарт де-факто, 50M+ загрузок |
| WebSocket | Laravel Reverb | First-party, встроен с Laravel 11 |
| Queue | Redis + Laravel Queue | Redis уже в Docker |
| LLM | z.ai API (GLM-4.6V) | Vision-модель для анализа изображений |
| Masonry | CSS `column-count` | Без лишних зависимостей |
| Real-time (frontend) | Laravel Echo + pusher-js | Стандарт для Reverb broadcasting |
| Infinite scroll | Quasar QInfiniteScroll | Встроен в Quasar |

---

## Поток генерации комментария

```
1. [Кнопка "Сгенерировать"] → POST /api/comments/generate {image_url, caption_text}
2. [Laravel] → dispatch(GenerateCommentJob) → return {job_id}
3. [Frontend] → Echo.private(`comment-generation.${job_id}`).listen(...)
4. [Job шаг 1] → скачать изображение → broadcast "Загрузка изображения..."
5. [Job шаг 2] → отправить в z.ai API → broadcast "Анализ изображения..."
6. [Job шаг 3] → получить ответ → broadcast "Комментарий готов" + текст
7. [Frontend] → обновить статус → вставить комментарий в поле ввода
```

---

## Data Flow (расширенный)

```
[Vue SPA] → [Laravel API] → [Python FastAPI] → [Instagram (instagrapi)]
                ↓
          [Redis Queue] → [GenerateCommentJob] → [z.ai LLM API]
                ↓
          [Laravel Reverb] ←→ [Frontend (Echo + pusher-js)]
```
