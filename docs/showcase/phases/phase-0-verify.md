# Phase 0 — Live-verify осуществимости (ДО любого кода фичи)

> **Гейт всего проекта.** Цель — на ЖИВОМ аккаунте доказать, что каждая IG-операция реально работает
> и сохраняется после refresh, и зафиксировать точную форму ответов (под DTO/сериализацию). Не строить
> UI поверх непроверенной механики. Rate-limit first: минимум вызовов, только reversible-тесты.

## Что проверяем (и что фиксируем)

| Проверка | Метод | Что зафиксировать |
|---|---|---|
| Свои посты | `user_medias_paginated(cl.user_id, amount=12)` | полный набор полей; **как отдаётся `is_pinned`**; форма для карусели (`resources`); работает ли курсор |
| Профиль владельца | `user_info(cl.user_id)` | counts/bio/avatar/private/verified |
| Снимок поста | `media_info_v1(media_pk)` | совпадает ли с элементом сетки |
| Edit подписи (reversible) | `media_edit(media_id, caption)` | применяется ли; виден ли после повторного `user_medias`; принимает ли usertags/location |
| Archive→Unarchive (reversible) | `media_archive`/`media_unarchive` + `archive_medias` | уходит ли из `user_medias`, появляется ли в архиве, возвращается ли |
| Pin→Unpin (reversible) | `media_pin`/`media_unpin` | как отражается закрепление в ответе |
| Insights (личный аккаунт) | `insights_media_feed_all` | падает ли предсказуемой ошибкой (подтверждает: личный = counts-lite) |
| Delete | `media_delete` | **НЕ гонять автоматически** — необратимо; только на явно выделенном расходном посте по указанию владельца |

## Артефакт: reversible verify-скрипт

`python-service/scripts/verify_showcase_ops.py` (новый; пишет Kiro — зона python-service):
- Вход: путь к `session.json` (из `_TEST/`, см. `../debug-protocol.md` шаг 1), `--media-pk` (целевой пост
  для reversible-тестов), флаги `--read-only` (по умолчанию ON — только чтения), `--mutate` (включает
  reversible round-trip), `--allow-delete` (отдельно, требует `--delete-media-pk` расходного поста).
- Поведение reversible round-trip на ОДНОМ посте:
  1. читает текущую подпись → `media_edit` добавляет суффикс ` [verify]` → перечитывает → сверяет →
     **возвращает исходную подпись** → сверяет возврат;
  2. `media_archive` → проверяет уход из `user_medias` + наличие в `archive_medias` → `media_unarchive` →
     проверяет возврат;
  3. `media_pin` → проверяет флаг → `media_unpin` → проверяет возврат.
- Каждый шаг печатает: операция, до/после, persists-after-refetch (да/нет), сырой фрагмент ответа.
- Все вызовы — последовательно, с паузами (анти-бан), под одним клиентом сессии.
- Скрипт **идемпотентно-безопасен**: при сбое на середине печатает, что НЕ откатилось (чтобы владелец вернул вручную).

Запуск (на хосте/в контейнере python, по `../debug-protocol.md`):
```bash
# только чтения (безопасно)
docker compose exec python python scripts/verify_showcase_ops.py /app/_TEST/session.json --read-only
# reversible-мутации на конкретном посте (после явного согласия владельца)
docker compose exec python python scripts/verify_showcase_ops.py /app/_TEST/session.json --mutate --media-pk <PK>
```

Альтернатива без скрипта — ручные raw-запросы по `../debug-protocol.md` (curl к Python), но скрипт надёжнее
гарантирует откат и единый снимок ответов.

## Предусловия

1. [ ] Живой тестовый IG-аккаунт добавлен, `is_active=true`, есть хотя бы несколько собственных постов.
2. [ ] Актуальная `_TEST/session.json` извлечена (debug-protocol шаг 1), сессия не протухла.
3. [ ] Python-сервис поднят (`/health`→200).
4. [ ] Владелец указал: какой аккаунт тестовый, какой пост можно трогать reversible-мутациями, есть ли
       расходный пост для проверки delete (или delete не проверяем живьём).

## Чек-лист выполнения

- [ ] Kiro написал `verify_showcase_ops.py` (read + reversible-mutate + safety-флаги).
- [ ] Прогон `--read-only`: сетка/профиль/снимок поста читаются; зафиксирован формат + `is_pinned`.
- [ ] Прогон `--mutate` на согласованном посте: edit↔revert, archive↔unarchive, pin↔unpin — все persist + откатились.
- [ ] Зафиксирован вердикт по insights на личном аккаунте.
- [ ] (Опц., по согласию) delete на расходном посте.
- [ ] Результаты вписаны в [`../feasibility.md`](../feasibility.md) (раздел «нюансы Phase 0») и
      [`../api-contracts.md`](../api-contracts.md) (формы данных) — уточнить/подтвердить.

## Критерий готовности (gate → Phase 1)

Все read-операции дают полные данные с зафиксированным форматом; reversible-мутации доказанно
сохраняются и откатываются; путь сериализации своих постов выбран. Только после этого — Phase 1.

## Делегирование

- **Kiro (opus-4.8, max)** — написать `verify_showcase_ops.py` (точность по instagrapi + безопасный откат).
- **Прогон на живом аккаунте** — оркестратор/владелец по debug-protocol (нужен реальный аккаунт + согласие
  на reversible-мутации). Сбои/нюансы делегата → `../orchestration/retrospective.md`.
