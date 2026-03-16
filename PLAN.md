# insta-pilot — Master Plan

## Обзор

Админ-панель для управления Instagram-аккаунтами:
- Управление аккаунтами (CRUD) ✅
- Авторизация пользователей с ролями (admin / user)
- Лента Instagram-аккаунта (Masonry + лайки + инфо)
- Поиск по хэштегам / геолокации + генерация AI-комментариев
- Настройки LLM-провайдера
- Мониторинг активности аккаунтов (логирование действий + real-time)

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
| 6 | Мониторинг | `/monitoring` | auth | Обзор активности аккаунтов |
| 7 | Мониторинг (детали) | `/monitoring/:accountId` | auth | Логи, статистика, real-time |

---

## Нейминг

| Термин | Описание |
|--------|----------|
| `user` | Пользователь системы insta-pilot |
| `instagram-account` | Instagram-аккаунт, добавленный в систему |
| `media-post` | Публикация Instagram (фото/видео/альбом) |
| `llm-settings` | Настройки LLM-провайдера |
| `activity-log` | Запись действия с Instagram-аккаунтом (лайк, лента, поиск и т.д.) |

---

## Фазы реализации

### Фаза 0 — Основа ✅

- [x] FSD структура, shared/api, shared/lib, shared/ui
- [x] entities/instagram-account (типы, store, ProfileCard)
- [x] Страница аккаунтов (таблица, CRUD, модалки)
- [x] Backend: Controller, Repository, Service, миграция
- [x] Python: `/auth/login`, `/account/info`

---

### Фаза 1 — Авторизация и пользователи ✅

> [Backend →](PLAN-EXTEND-BACK.md#фаза-1--авторизация-и-пользователи) | [Frontend →](PLAN-EXTEND-FRONT.md#фаза-1--авторизация-и-пользователи)

**Backend:**
- [x] 1.1 Laravel Sanctum (SPA auth, token-based)
- [x] 1.2 Spatie/laravel-permission (роли: admin, user)
- [x] 1.3 Миграции: `is_active` для users, `user_id` для instagram_accounts
- [x] 1.4 AuthController (register, login, logout, me)
- [x] 1.5 EnsureUserIsActive middleware
- [x] 1.6 UserController (admin: список, toggle active, смена роли)
- [x] 1.7 Обновить InstagramAccountController (фильтрация по user_id)
- [x] 1.8 AdminSeeder (admin user + roles)

**Frontend:**
- [x] 1.9 entities/user (типы, authStore, token management)
- [x] 1.10 Axios interceptor (Bearer token, 401 → redirect)
- [x] 1.11 Страница логина (LoginPage)
- [x] 1.12 Auth guard в роутере (auth, guest, role)
- [x] 1.13 Страница пользователей (AdminUsersPage)
- [x] 1.14 MainLayout: навигация с учётом ролей + logout

---

### Фаза 2 — Лента аккаунта ✅

> [Backend →](PLAN-EXTEND-BACK.md#фаза-2--лента-аккаунта) | [Frontend →](PLAN-EXTEND-FRONT.md#фаза-2--лента-аккаунта)

**Python:**
- [x] 2.1 `POST /account/feed` (таймлайн + пагинация через max_id)
- [x] 2.2 `POST /user/info` (детали пользователя по pk)

**Laravel:**
- [x] 2.3 FeedController (лента + лайк)
- [x] 2.4 InstagramUserController (инфо о пользователе)
- [x] 2.5 Обновить InstagramClientService (getFeed, getUserInfoByPk, likeMedia)

**Frontend:**
- [x] 2.6 shared/ui: MasonryGrid (CSS columns, 3 колонки)
- [x] 2.7 shared/ui: MediaCard (thumbnail + hover overlay с лайком и инфо)
- [x] 2.8 entities/media-post (типы MediaPost, MediaUser, InstagramUserDetail)
- [x] 2.9 feedStore (Pinia: fetchFeed, likePost, fetchUserInfo)
- [x] 2.10 Страница ленты (FeedPage: выбор аккаунта + Masonry + QInfiniteScroll)
- [x] 2.11 Модалка поста (PostDetailModal: фото/видео, caption, статистика)
- [x] 2.12 Модалка пользователя (InstagramUserModal: аватар, bio, подписчики)

---

### Фаза 3 — Поиск по тегам/гео + комментарии ✅

> [Backend →](PLAN-EXTEND-BACK.md#фаза-3--поиск-по-тегамгео) | [Frontend →](PLAN-EXTEND-FRONT.md#фаза-3--поиск-по-тегамгео)

**Python:**
- [x] 3.1 `POST /search/hashtag` (медиа по хэштегу)
- [x] 3.2 `POST /search/locations` (поиск мест по названию)
- [x] 3.3 `POST /search/location` (медиа по локации)
- [x] 3.4 `POST /media/comment` (отправка комментария)

**Laravel:**
- [x] 3.5 SearchController (хэштег, локации, медиа по локации)
- [x] 3.6 CommentController (отправка комментария)
- [x] 3.7 Обновить InstagramClientService (searchHashtag, searchLocations, searchLocationMedias, commentMedia)

**Frontend:**
- [x] 3.8 Страница поиска (SearchPage: toggle хэштег/гео, поле ввода)
- [x] 3.9 Masonry с результатами (переиспользование MasonryGrid + MediaCard)
- [x] 3.10 Модалка поста с комментарием (SearchPostModal: автор, контент, статистика, ввод)
- [x] 3.11 Кнопки "Сгенерировать" + "Отправить" (UI готов, генерация → Фаза 4)
- [x] 3.12 searchStore (Pinia: searchHashtag, searchLocations, searchLocation, sendComment)

---

### Фаза 4 — LLM интеграция (настройки + генерация + WebSocket) ✅

> [Backend →](PLAN-EXTEND-BACK.md#фаза-4--llm-интеграция) | [Frontend →](PLAN-EXTEND-FRONT.md#фаза-4--llm-интеграция)

**Laravel:**
- [x] 4.1 LlmSetting модель + миграция (provider, api_key, model_name, system_prompt, tone)
- [x] 4.2 LlmSettingsController (show, update, testConnection)
- [x] 4.3 LlmService (z.ai API: скачать изображение → отправить с промптом)
- [x] 4.4 GenerateCommentJob (queue: download → LLM → broadcast result)
- [x] 4.5 CommentGenerationProgress event (ShouldBroadcast)
- [x] 4.6 CommentGenerateController (`POST /api/comments/generate` → dispatch job)
- [x] 4.7 Laravel Reverb (WebSocket сервер, `php artisan install:broadcasting`)
- [x] 4.8 Docker: reverb + queue-worker сервисы

**Frontend:**
- [x] 4.9 entities/llm-settings (типы, llmSettingsStore)
- [x] 4.10 Страница настроек LLM (LlmSettingsPage: форма + тест)
- [x] 4.11 shared/lib/useEcho (Laravel Echo + pusher-js инициализация)
- [x] 4.12 features/generate-comment: useCommentGeneration composable (WebSocket + статус)
- [x] 4.13 Блок статуса генерации в SearchPostModal (QTimeline/stepper)
- [x] 4.14 Вставка сгенерированного комментария в поле ввода

---

### Фаза 5 — Мониторинг активности аккаунтов

> [Полный план →](PLAN-EXTEND-LOGGING-FULL.md) | [Backend →](PLAN-EXTEND-LOGGING-BACKEND.md) | [Frontend →](PLAN-EXTEND-LOGGING-FRONT.md)

**Python:**
- [ ] 5.1 Структурированные ошибки: добавить `error_code` в ответы Python-сервиса (rate_limited, challenge_required, login_required, timeout)

**Laravel:**
- [ ] 5.2 Миграция `create_account_activity_logs_table` (action, status, request_payload, response_summary, error_message, error_code, duration_ms)
- [ ] 5.3 Модель `AccountActivityLog`
- [ ] 5.4 `ActivityLoggerService` (Interface + Implementation): логирование + broadcast
- [ ] 5.5 `ActivityLogRepository` (Interface + Implementation): cursor-пагинация, агрегация, cleanup
- [ ] 5.6 `ActivityLogCreated` event (ShouldBroadcast → канал `account-activity.{accountId}`)
- [ ] 5.7 `ActivityLogController` (index: логи с фильтрами, stats: агрегация, summary: обзор)
- [ ] 5.8 Интеграция в `InstagramClientService` (логирование каждого вызова Python)
- [ ] 5.9 Интеграция в `GenerateCommentJob` (Фаза 4)
- [ ] 5.10 `PruneActivityLogs` artisan command (cleanup старых записей по расписанию)

**Frontend:**
- [ ] 5.11 `entities/activity-log` (типы, constants, activityLogStore с cursor-пагинацией)
- [ ] 5.12 DTO + колонки таблиц (логи + summary)
- [ ] 5.13 `MonitoringPage` — обзор всех аккаунтов (summary table, клик → детали)
- [ ] 5.14 `MonitoringDetailPage` — детализация: карточки статистики + группировки + таблица логов
- [ ] 5.15 `ActivityFilter` (feature: фильтры по действию, статусу, дате)
- [ ] 5.16 `useActivityLive` composable (WebSocket подписка на real-time логи)
- [ ] 5.17 Router: `/monitoring`, `/monitoring/:accountId` + MainLayout навигация

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
| Activity Logging | `account_activity_logs` + Reverb broadcast | Persistence в БД + real-time через WebSocket |
| Cursor pagination | `before_id` вместо offset | Эффективно для append-only логов + не ломается при real-time вставках |

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
                ↓                    ↓
          [Redis Queue]     [ActivityLoggerService] → [account_activity_logs]
                ↓                    ↓
          [GenerateCommentJob]   [ActivityLogCreated event]
                ↓                    ↓
          [z.ai LLM API]     [Laravel Reverb] ←→ [Frontend (Echo + pusher-js)]
```
