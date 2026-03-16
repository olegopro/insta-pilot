# Как получить bloks_versioning_id для Instagram

## Что это

`bloks_versioning_id` — хеш (SHA-256) внутреннего UI-фреймворка Instagram ("Bloks").
Передаётся в каждом API-запросе как заголовок `X-Bloks-Version-Id`.
Меняется с каждой новой версией приложения.

## Где используется в проекте

- `device-profiles.json` → поле `device_settings.bloks_versioning_id`
- instagrapi передаёт его через `self.bloks_versioning_id` в HTTP-заголовках
- Если значение `None` — API-запросы могут быть отклонены Instagram

## Способы извлечения

### 1. Android — MITM-прокси (рабочий способ)

Перехватить заголовок из реального трафика Instagram-приложения.

**Что нужно:**
- Эмулятор Android (Android Studio AVD) или рутованный телефон
- MITM-прокси: mitmproxy, Charles Proxy или HTTP Toolkit
- Нужная версия Instagram APK (скачать с apkmirror.com)

**Шаги:**

```
1. Установить mitmproxy:
   pip install mitmproxy

2. Запустить прокси:
   mitmproxy --listen-port 8888

3. На устройстве/эмуляторе:
   - Настроить Wi-Fi прокси → IP компьютера:8888
   - Установить CA-сертификат mitmproxy (http://mitm.it)
   - Для Android 7+ нужен рут или патч APK для доверия user-сертификатам

4. Открыть Instagram → выполнить любое действие (лента, лайк, и т.д.)

5. В mitmproxy найти запрос к i.instagram.com → заголовок:
   X-Bloks-Version-Id: <нужное значение>
```

### 2. iOS — из бандла приложения

**Что нужно:**
- Jailbroken iPhone или frida-ios-dump

**Шаги:**

```
1. Извлечь .ipa через frida-ios-dump:
   dump.py com.burbn.instagram

2. Распаковать .ipa (это ZIP-архив)

3. Найти файл:
   Payload/Instagram.app/prepackaged_bloks_config.json

4. Извлечь значение:
   cat prepackaged_bloks_config.json | jq '.versioning.bloks_versioning_id'
```

### 3. Web-версия Instagram

Самый простой способ, но даёт **web-версию** ID (может отличаться от Android).

```
1. Открыть instagram.com в браузере
2. DevTools → Network → найти запрос к i.instagram.com/api/v1/
3. В заголовках запроса найти X-Bloks-Version-Id
   Или в ответе: JSON path → versioning.bloks_versioning_id
```

### 4. Из Android APK напрямую — НЕ РАБОТАЕТ

По данным проекта github.com/novitae/igbloks:
> "No way has been found yet" для Android.

Значение компилируется в нативный код и не доступно
через apktool/jadx декомпиляцию.

## Практический подход (текущий)

Если нет возможности перехватить реальный трафик:
- Использовать последний известный `bloks_versioning_id` из instagrapi
- Instagram обратно совместим по этому полю
- Текущее значение (из instagrapi 385.0.0.47.74):
  `a8973d49a9cc6a6f65a4997c10216ce2a06f65a517010e64885e92029bb19221`

## Как обновить в проекте

1. Получить новый `bloks_versioning_id` одним из способов выше
2. Обновить `device-profiles.json` → поле `device_settings.bloks_versioning_id`
3. Перезапустить seeder: `php artisan db:seed --class=DeviceProfileSeeder`

## Источники

- https://github.com/novitae/igbloks/tree/main/KNOWLEDGES
- https://github.com/subzeroid/instagrapi/issues/2268
- https://github.com/subzeroid/instagrapi/blob/master/instagrapi/config.py
