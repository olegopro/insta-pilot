# TODO: Рефакторинг

## Фасад InstagramClient — не подключён до конца

**Файл:** `app/Facades/InstagramClient.php`

**Проблема:**
`getFacadeAccessor()` возвращает строку `'InstagramClient'`, но в `AppServiceProvider`
привязка зарегистрирована по ключу `InstagramClientServiceInterface::class` — это разные строки.
Поэтому `InstagramClient::someMethod()` упадёт с ошибкой контейнера.

**Что сделать:**
Добавить алиас в `AppServiceProvider::register()`:

```php
$this->app->alias(InstagramClientServiceInterface::class, 'InstagramClient');
```

**Или альтернатива:** изменить `getFacadeAccessor()` чтобы возвращал имя интерфейса:

```php
protected static function getFacadeAccessor(): string {
    return InstagramClientServiceInterface::class;
}
```

**Статус:** Фасад нигде не используется в проекте — везде предпочтён прямой DI через конструктор. Можно либо починить, либо удалить.

---

## Двойная обработка 401 при навигации — конфликт axios interceptor и router guard

**Файлы:** `frontend-vue/src/boot/axios.ts`, `frontend-vue/src/router/index.ts`

**Проблема:**
Когда router guard вызывает `authStore.fetchMe()` и токен протух, происходят два редиректа подряд:

1. Axios response interceptor (срабатывает первым):
   ```typescript
   localStorage.removeItem('token')
   window.location.href = '/#/login'  // ← жёсткий редирект, полная перезагрузка страницы
   ```
2. Catch-блок в router guard (срабатывает следом):
   ```typescript
   authStore.clearAuth()
   return { path: '/login' }  // ← Vue Router редирект, но страница уже перезагружается
   ```

`window.location.href` — это жёсткая перезагрузка, она обходит Vue Router. Vue Router редирект из catch-блока уже не нужен, но оба механизма отрабатывают.

**Что сделать:**
В axios interceptor для случая протухшего токена (вне `/auth/login`) использовать Vue Router вместо `window.location.href`:
```typescript
import { router } from '@/router'
// ...
if (error.response?.status === 401 && !isAuthLogin) {
    localStorage.removeItem('token')
    router.push('/login')  // ← Vue Router, без перезагрузки
}
```
Тогда catch-блок в guard можно упростить или убрать дублирование.

**Статус:** Работает, но жёсткая перезагрузка — лишняя. Особенно заметно если пользователь был в середине заполнения формы.

---

## Неправильный HTTP-код при неверном пароле — 401 вместо 422

**Файл:** `backend-laravel/app/Http/Controllers/AuthController.php`

**Проблема:**
`AuthController::login()` возвращает 401 при неверных учётных данных:
```php
if (!Auth::attempt($validated)) {
    return response()->json(['success' => false, 'error' => '...'], 401);
}
```
Но 401 семантически означает «не аутентифицирован / невалидный токен» — это то, что возвращает Sanctum middleware при протухшем токене.
Из-за совпадения кодов на фронтенде пришлось добавить URL-хак:
```typescript
const isAuthLogin = error.config?.url?.includes('/auth/login')
if (error.response?.status === 401 && !isAuthLogin) { ... }
```

**Что сделать:**
Изменить код ответа при неверном пароле на **422** (ошибка бизнес-логики):
```php
if (!Auth::attempt($validated)) {
    return response()->json(['success' => false, 'error' => '...'], 422);
}
```
Тогда в axios interceptor убрать URL-проверку — он будет ловить только настоящие 401 от Sanctum:
```typescript
if (error.response?.status === 401) {
    localStorage.removeItem('token')
    router.push('/login')
}
```

**Статус:** Работает через хак. Нужно поменять код в контроллере и упростить interceptor.
