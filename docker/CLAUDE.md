# Docker / Инфраструктура

> **Справка по инфраструктуре для `docker/`.** Глобальный контекст и карта документации — в [`../CLAUDE.md`](../CLAUDE.md).

## Docker Services
- `vue`          → port 9000 (Vite dev server)
- `laravel`      → port 8000 (PHP-FPM + Artisan serve)
- `python`       → port 8001 (FastAPI + instagrapi)
- `postgres`     → port 5432 (PostgreSQL 16)
- `redis`        → port 6379 (Queue + Broadcasting)
- `reverb`       → port 8080 (WebSocket сервер, Laravel Reverb)
- `queue-worker` → Redis queue worker (обработка Jobs)

## Environment
Root `.env`: `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `INSTAGRAM_SALT`
Frontend `.env`: `VITE_API_URL=http://localhost:8000/api/`
Laravel: `INSTAGRAM_PYTHON_URL=http://python:8001` (внутренний Docker URL)

## Сборка образов
Dockerfile-ы лежат по сервисам: `docker/laravel`, `docker/python`, `docker/vue`, `docker/nginx`.
Оркестрация всех контейнеров — `docker-compose.yml` в корне.

## Образы
Python-сервис собирается на `python:3.12-slim` (instagrapi требует Python ≥3.10). Локальный `venv` 3.9
для запуска не годится — тесты гонять в контейнере.

## Очереди и воркеры
Два воркера: основной (очередь `default`) и отдельный `automation-worker` (очередь `automation`).
`retry_after=300` держим больше, чем job timeout; у `automation-worker` стоит `--timeout=180`
(больше job comment 120, меньше `retry_after` 300).

## Масштабирование
`automation-worker` масштабируется командой `docker compose up -d --scale automation-worker=N`
(у `automation-worker` НЕТ `container_name`). Многоворкерность безопасна: диспетчер использует
`FOR UPDATE SKIP LOCKED`, исполнение — CAS-claim. Реальный параллелизм идёт по РАЗНЫМ аккаунтам
(Python `account_lock` сериализует операции одного аккаунта).

## Грабли
`queue:work` кэширует код — после правок рестартить и `queue-worker`, и `automation-worker`.

## Связанные документы
- [`../docs/automation/architecture.md`](../docs/automation/architecture.md) — почему выделена отдельная очередь/воркер `automation` и инварианты движка.
