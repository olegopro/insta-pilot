# Backend — Laravel 13

> **Императивные правила для `backend-laravel/`.** Глобальный контекст и карта документации — в [`../CLAUDE.md`](../CLAUDE.md).

## Документация
- Laravel 12: Context7 library ID: `/websites/laravel_12_x`
- Laravel (общая): Context7 library ID: `/laravel/docs`

## Правила
- `declare(strict_types=1)` в каждом PHP файле
- Controllers: `final class`, только `JsonResponse` в return
- DI через конструктор, `private readonly`
- Паттерн: Interface → Implementation → bind в AppServiceProvider → (опционально) Facade
- Фигурная скобка `{` на той же строке: `class Foo {`, `function bar(): void {`, `interface Baz {`
- Trailing comma в массивах не ставится: `['a', 'b', 'c']`, не `['a', 'b', 'c',]`
- Массивы с 2+ элементами — многострочно, каждый элемент на своей строке

## Структура app/
```
Http/Controllers/             # final class, readonly DI, JsonResponse
Http/Middleware/               # EnsureUserIsActive и другие
Models/                       # Eloquent, шифрование через Accessors
Models/Concerns/              # Trait-ы моделей (HasEncryption)
Providers/AppServiceProvider  # все bindings в register()
Repositories/                 # Interface + Implementation
Services/                     # Interface + Implementation
Jobs/                         # Queue jobs (GenerateCommentJob)
Events/                       # Broadcasting events
Facades/                      # extends Facade → aliases в config/app.php
Console/                      # Artisan commands
```

## API Response Format
```php
// Успех
return response()->json(['success' => true, 'data' => $data, 'message' => 'OK']);
// Ошибка
return response()->json(['success' => false, 'error' => 'Описание'], 500);
```

## Таблица instagram_accounts
| Поле                    | Тип                   | Описание                |
|-------------------------|-----------------------|-------------------------|
| id                      | bigIncrements         | PK                      |
| user_id                 | FK, nullable          | владелец (users), nullOnDelete |
| instagram_login         | string, unique        | логин                   |
| instagram_password      | text                  | зашифрован              |
| session_data            | text, nullable        | JSON сессии, зашифрован |
| proxy                   | string, nullable      | прокси                  |
| full_name               | string, nullable      | имя из Instagram        |
| profile_pic_url         | text, nullable        | URL аватарки            |
| device_profile_id       | FK, nullable          | профиль устройства (device_profiles), nullOnDelete |
| device_model_name       | string, nullable      | модель устройства аккаунта |
| is_active               | boolean, default true |                         |
| last_used_at            | timestamp, nullable   |                         |
| created_at / updated_at | timestamps            |                         |

Шифрование через Accessors в модели с `INSTAGRAM_SALT` → `config('app.instagram_salt')`.

## Таблица device_profiles
| Поле         | Тип            | Описание                            |
|--------------|----------------|-------------------------------------|
| id           | bigIncrements  | PK                                  |
| code         | string, unique | код профиля                         |
| title        | string         | название профиля                    |
| device_settings | json        | UUID и параметры устройства (Android) |
| user_agent   | text           | User-Agent строка                   |
| is_active    | boolean, default true |                              |
| created_at / updated_at | timestamps |                            |

Данные хранятся в `backend-laravel/data/device-profiles/device-profiles.json`. Заполняются через `DeviceProfileSeeder`. Назначается аккаунту при добавлении (`device_profile_id`) — передаётся в Python как заголовки запросов.

## Таблица account_activity_logs
| Поле              | Тип               | Описание                                 |
|-------------------|-------------------|------------------------------------------|
| id                | bigIncrements     | PK                                       |
| instagram_account_id | FK             | аккаунт (cascadeOnDelete)                |
| user_id           | FK                | пользователь-владелец (cascadeOnDelete)  |
| action            | string            | тип действия (login, like, comment, ...) |
| status            | string            | success / fail                           |
| http_code         | smallInteger, nullable | HTTP-код ответа                     |
| endpoint          | string, nullable  | вызванный endpoint                       |
| request_payload   | json, nullable    | payload запроса (cast array, sanitized)  |
| response_summary  | json, nullable    | сводка ответа (cast array)               |
| error_message     | text, nullable    | текст ошибки                             |
| error_code        | string, nullable  | код ошибки                               |
| duration_ms       | integer, nullable | время выполнения запроса                 |
| created_at        | timestamp, useCurrent | без updated_at (`$timestamps=false`) |

Логирование через `ActivityLoggerService` / `ActivityLoggerServiceInterface`. Репозиторий: `ActivityLogRepository`. Broadcasting event: `ActivityLogCreated` (каналы `private:account-activity.{accountId}` и `private:activity-global.{userId}`).

## Таблица llm_settings
| Поле          | Тип                   | Описание                        |
|---------------|-----------------------|---------------------------------|
| id            | bigIncrements         | PK                              |
| provider      | string                | glm / openai                    |
| api_key       | text                  | зашифрован (hidden по умолчанию)|
| model_name    | string                | имя модели LLM                  |
| system_prompt | text, nullable        | системный промпт                |
| tone          | string, nullable      | friendly/professional/casual/humorous |
| use_caption   | boolean, default true | передавать ли описание поста в LLM |
| is_default    | boolean, default false| провайдер по умолчанию          |

## WebSocket (Laravel Reverb)
- Broadcasting через Laravel Echo + pusher-js
- Frontend: `echo` instance в `shared/lib/echo.ts`

| Канал | Event | Назначение |
|-------|-------|-----------|
| `private:comment-generation.{jobId}` | `CommentGenerationProgress` | прогресс генерации (starting → downloading → analyzing → completed/failed) |
| `private:account-activity.{accountId}` | `ActivityLogCreated` | новая запись лога аккаунта в реальном времени |
| `private:activity-global.{userId}` | `ActivityLogCreated` | глобальный поток логов пользователя (admin) |

## Тесты (конвенции) — backend
Запуск (в контейнере): `docker compose exec laravel php artisan test` (sqlite `:memory:`).
- **Авторитет покрытия по слоям, без дублей** (кросс-слойное правило): для бэка границы авторизации (401/403/404/ownership) покрываются в Laravel Feature/e2e; шифрование — один авторитетный Model-unit на сущность.
- **Параметризация однотипных кейсов**: BE — `#[\PHPUnit\Framework\Attributes\DataProvider('name')]` (БД-stateful кейсы только через DataProvider — даёт изоляцию `RefreshDatabase`, не через `foreach`). При слиянии сохранять каждый уникальный state-инвариант.
- **Не писать тавтологии**: не тестировать `$fillable`/штатные касты Eloquent/Spatie-трейты/литералы конфига (`tries`, имя события).

## Связанные документы
- [`../AUTOMATION-ARCHITECTURE.md`](../AUTOMATION-ARCHITECTURE.md) — слои движка автоматизации, 9 таблиц, инварианты.
- [`../DEBUG_PROTOCOL.md`](../DEBUG_PROTOCOL.md) — чек-лист ручных проверок с живым IG.
- [`../documentation/01-realtime-websocket.md`](../documentation/01-realtime-websocket.md) — Reverb/Echo realtime.
- [`../documentation/02-llm-generation.md`](../documentation/02-llm-generation.md) — генерация комментов через LLM.
