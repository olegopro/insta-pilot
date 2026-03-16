# План внедрения пресетов устройств и User-Agent

## 1) Аудит текущего поведения

### Python (`python-service/main.py`)
- Сейчас при `POST /auth/login` создаётся `Client()`, опционально ставится proxy, затем `cl.login(login, password)`.
- Явной установки `device_settings` и `user_agent` нет.
- Это означает, что поведение зависит от внутренних дефолтов instagrapi и от сохранённых `settings` после логина.

### Laravel (`backend-laravel`)
- `InstagramAccountController@login` валидирует логин/пароль/proxy и вызывает `InstagramClientService::login`.
- `InstagramClientService::login` проксирует в Python `/auth/login`.
- В БД `instagram_accounts` сейчас нет явной связи с выбранным устройством/моделью.

### Frontend (`frontend-vue`)
- В модалке добавления аккаунта есть логин/пароль/proxy.
- Выбора устройства нет.
- В таблице аккаунтов нет колонки модели устройства.

## 2) Целевое состояние

- Добавить каталог готовых пресетов устройств Android (реалистичные поля `device_settings` + `user_agent`).
- При добавлении Instagram-аккаунта пользователь выбирает пресет из списка по читаемому названию устройства.
- Выбранный пресет:
  - передаётся в Python на момент логина;
  - сохраняется в Laravel у аккаунта как `device_profile_id` и `device_model_name`.
- На странице «Аккаунты» в таблице появляется колонка «Модель устройства».

## 3) Данные и хранение

### Новая таблица `device_profiles`
- `id`
- `code` (unique)
- `title` (читаемое название устройства)
- `device_settings` (json)
- `user_agent` (text)
- `is_active` (bool)
- `timestamps`

### Изменения `instagram_accounts`
- `device_profile_id` nullable foreign key -> `device_profiles.id`
- `device_model_name` nullable string

### Наполнение пресетов
- Добавить JSON-файлы в `backend-laravel/database/seeders/data/device-profiles/`.
- Добавить seeder, который читает JSON и делает upsert по `code`.
- Подключить seeder в `DatabaseSeeder`.

## 4) Backend API

### Новые сущности
- `App\Models\DeviceProfile`

### Роут
- `GET /api/accounts/device-profiles` (auth-группа)

### Контроллер
- В `InstagramAccountController` добавить метод `deviceProfiles`, возвращающий активные профили (id, code, title).
- В `login` добавить валидацию `device_profile_id` и загрузку выбранного профиля.
- Передавать в Python payload вида:
  - `device_profile.device_settings`
  - `device_profile.user_agent`
- При успешном создании аккаунта сохранять:
  - `device_profile_id`
  - `device_model_name` (из `title`)

### Сервисный слой
- Расширить `InstagramClientServiceInterface::login(...)`.
- Обновить `InstagramClientService::login(...)`, чтобы прокидывать `device_profile` в Python.

## 5) Python service

### Модели запроса
- Расширить `LoginRequest`:
  - `device_profile: Optional[...]`
- Добавить pydantic-модель для вложенного профиля:
  - `device_settings: dict`
  - `user_agent: str`

### Логика логина
- До `cl.login(...)`:
  - если `device_profile` передан, вызвать `cl.set_device(device_settings)` и `cl.set_user_agent(user_agent)`.
- Остальная логика остаётся прежней.

## 6) Frontend

### Types/store
- Добавить тип `DeviceProfile` в `entities/instagram-account/model/types.ts`.
- Расширить `AddAccountRequest` полем `device_profile_id`.
- В `accountStore` добавить:
  - загрузку профилей устройств;
  - публичные `deviceProfiles`, `fetchDeviceProfiles`, `fetchDeviceProfilesLoading`.

### Модалка добавления аккаунта
- В `AddInstagramAccountModal.vue`:
  - добавить `SelectComponent` для выбора устройства;
  - опции брать из store;
  - отображать `title`;
  - отправлять `device_profile_id` вместе с логином/паролем.

### Таблица аккаунтов
- В row model/DTO добавить `deviceModelName` из `device_model_name`.
- Добавить колонку «Модель устройства».

## 7) Тесты и валидация

### Backend
- Обновить `tests/Feature/InstagramAccount/InstagramAccountTest.php`:
  - мок логина с `device_profile_id`;
  - проверка сохранения `device_profile_id` и `device_model_name`;
  - проверка endpoint списка профилей.

### Frontend
- Обновить `instagramAccountListDTO.spec.ts` под новое поле.

### Команды проверки
- Backend: `php artisan test`
- Frontend lint: `npx eslint --fix ./src`
- Frontend typecheck: `npx vue-tsc --noEmit`
- Frontend tests: `npm run test:unit`

## 8) Источник полей для device_settings

Для `instagrapi` используются поля формата settings:
- `cpu`
- `dpi`
- `model`
- `device`
- `resolution`
- `app_version`
- `manufacturer`
- `version_code`
- `android_release`
- `android_version`

Также отдельно задаётся строка `user_agent`.

## 9) Риски и ограничения

- Неверные/нереалистичные связки полей (device/app_version/android) повышают риск challenge/login_required.
- Поэтому пресеты делаем фиксированными и проверяемыми, без пользовательского редактирования на первом этапе.
- Добавление новых пресетов через UI не делаем на этом этапе.
