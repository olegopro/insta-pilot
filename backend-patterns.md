# Backend Patterns

## Слои (всегда Interface → Implementation → bind в AppServiceProvider)

```
Repositories/  — работа с БД через Eloquent
Services/      — бизнес-логика (HTTP к Python и т.д.)
Facades/       — опционально, для удобного вызова
```

## Controller

```php
final class FooController extends Controller {
    public function __construct(
        private readonly FooServiceInterface $service,
        private readonly FooRepositoryInterface $repo,
    ) {}

    public function action(Request $request): JsonResponse {
        $data = $request->validate([...]);
        $result = $this->service->doSomething($data);
        return response()->json(['success' => true, 'data' => $result]);
    }
}
```

## Шифрование (пароли, session_data)

```php
// В модели через Accessor, ключ из INSTAGRAM_SALT + APP_KEY
$derivedKey = substr(hash('sha256', config('app.key') . config('app.instagram_salt'), true), 0, 32);
$encrypter = new Encrypter($derivedKey, 'AES-256-CBC');
```
