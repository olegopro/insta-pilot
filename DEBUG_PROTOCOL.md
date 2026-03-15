# Debug Protocol — Цепочка тестирования Python → Laravel

Инструкция для отладки запросов по цепочке: **Python (raw instagrapi)** → **Laravel (сервис)** → сравнение.

Все артефакты складываются в `_TEST/`. Файлы нумеруются по шагам: `01_python_...json`, `02_laravel_...json`.

---

## 1. Подготовка: извлечь session_data

Session data хранится в БД зашифрованным. Извлечь через Tinker и сохранить в `_TEST/session.json`:

```bash
docker compose exec -T laravel php artisan tinker <<'TINKER'
$id = 3;
$a = \App\Models\InstagramAccount::find($id);
file_put_contents(base_path("session_{$id}.json"), json_encode(json_decode($a->session_data, true), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "OK";
TINKER
cp backend-laravel/session_3.json _TEST/session.json
```

> `base_path()` пишет в контейнер → монтируется в `backend-laravel/`. Tinker может добавить мусор в stdout, поэтому сохраняем через `file_put_contents`, а не редирект.

### Узнать доступные аккаунты

```bash
docker compose exec -T laravel php artisan tinker <<'TINKER'
echo \App\Models\InstagramAccount::select('id', 'instagram_login', 'is_active')->get()->toJson(JSON_PRETTY_PRINT);
TINKER
```

---

## 2. Тестирование Python (raw)

Прямые запросы к Python-сервису на `localhost:8001`. Session data передаётся как JSON-строка.

### Шаблон запроса

```bash
jq -n --arg sd "$(cat _TEST/session.json)" \
  '{session_data: $sd, PARAM1: "value1", PARAM2: "value2"}' | \
curl -s -X POST http://localhost:8001/ENDPOINT \
  -H "Content-Type: application/json" \
  -d @- | jq . > _TEST/01_python_НАЗВАНИЕ.json
```

`jq -n --arg sd "$(cat ...)"` — корректно упаковывает JSON сессии в строку.

### Примеры endpoint'ов

| Endpoint | Обязательные поля (кроме session_data) |
|---|---|
| `/search/hashtag` | `hashtag`, `amount` (opt), `next_max_id` (opt) |
| `/search/locations` | `query` |
| `/search/location` | `location_pk`, `amount` (opt), `next_max_id` (opt) |
| `/account/feed` | `reason` (cold_start_fetch), `max_id` (opt), `seen_posts` (opt), `min_posts` (opt) |
| `/account/info` | — |
| `/user/info` | `user_pk` |
| `/media/like` | `media_id` |
| `/media/comment` | `media_id`, `text` |

---

## 3. Тестирование Laravel (через Tinker)

Tinker позволяет вызывать сервисы напрямую, **минуя HTTP, Sanctum, middleware**. Чистый вызов бизнес-логики.

### Шаблон

```bash
docker compose exec -T laravel php artisan tinker <<'TINKER' | tail -n +2 | jq . > _TEST/02_laravel_НАЗВАНИЕ.json
$account = \App\Models\InstagramAccount::find(3);
$service = app(\App\Services\InstagramClientServiceInterface::class);
$result = $service->METHOD_NAME($account->session_data, ...аргументы);
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
TINKER
```

`tail -n +2` — убирает первую строку Tinker (prompt). Если мусор остаётся, пропустить через `jq .`.

Актуальный список методов и их сигнатуры — в `backend-laravel/app/Services/InstagramClientServiceInterface.php`.

---

## 4. Тестирование Laravel (через cURL + Bearer)

Когда нужно проверить полный HTTP-стек (middleware, контроллер, сериализация).

### Получить токен

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@insta-pilot.local","password":"password"}' | jq -r '.data.token')
echo $TOKEN
```

### Шаблон запроса

```bash
# GET
curl -s "http://localhost:8000/api/ENDPOINT?param=value" \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" \
  | jq . > _TEST/03_laravel_http_НАЗВАНИЕ.json

# POST — добавить -X POST, -H "Content-Type: application/json", -d '{"key":"value"}'
```

---

## 5. Сравнение результатов

После выполнения шагов 2 и 3 (или 4) — в `_TEST/` лежат пронумерованные JSON.

### Что сравнивать

- **Структура**: одинаковые ли ключи на верхнем уровне
- **Данные**: совпадают ли `items[]`, `posts[]`, `locations[]`
- **Трансформации**: что Laravel изменил/добавил/убрал по сравнению с Python raw
- **Ошибки**: если Python вернул ошибку — как она проброшена в Laravel

### Быстрое сравнение ключей

```bash
# Ключи Python-ответа
jq 'keys' _TEST/01_python_*.json

# Ключи Laravel-ответа
jq 'keys' _TEST/02_laravel_*.json

# Количество элементов в массиве
jq '.items | length' _TEST/01_python_*.json
jq '.data.items | length' _TEST/02_laravel_*.json
```

---

## 6. Тестирование Python-скриптами

Для сложных сценариев (пагинация, цепочки запросов) — использовать Python-скрипты из `python-service/`.

```bash
python-service/venv/bin/python python-service/test_feed_pagination.py \
  _TEST/session.json --pages 3
```

---

## 7. Нейминг файлов в _TEST/

Формат: `{префикс}_{операция}.json`

| Префикс | Слой |
|---|---|
| `01_python_` | Сырой ответ Python-сервиса |
| `02_laravel_` | Laravel-сервис через Tinker |
| `03_laravel_http_` | Laravel через HTTP (cURL + Bearer) |

Операция — `search_hashtag`, `feed_cold_start`, `user_info` и т.д. Плюс `session.json` — всегда актуальная сессия.

---

## 8. Checklist для отладки нового endpoint'а

1. [ ] Извлечь `session.json` (если устарел) → шаг 1
2. [ ] Отправить raw-запрос в Python → сохранить `01_python_*.json`
3. [ ] Вызвать метод через Tinker → сохранить `02_laravel_*.json`
4. [ ] (опционально) Отправить HTTP-запрос в Laravel → `03_laravel_http_*.json`
5. [ ] Сравнить структуру и данные между слоями
6. [ ] Зафиксировать расхождения (если есть)

---

## Важно

- `_TEST/` — в `.gitignore`, не коммитить
- `session.json` содержит чувствительные данные (cookies, tokens) — не выкладывать
- Между тестами сессия может протухнуть — если 401/challenge, извлечь заново
- Python-сервис кэширует клиента 5 минут — при смене сессии подождать или перезапустить: `docker compose restart python`
