# Phase 3 — Реальные IG-мутации (edit / archive / delete / pin) + Save→push

> Здесь «Сохранить» реально доходит до Instagram и видно после refresh. Только то, что Phase 0 доказал
> работающим. Rate-limit first, подтверждения на необратимом.

## Объём

- Python: `/media/edit`, `/media/archive`, `/media/unarchive`, `/profile/archived`, `/media/delete`,
  `/media/pin`, `/media/unpin` (см. [`../api-contracts.md`](../api-contracts.md) #6–#12).
- Laravel: `InstagramClientService::editMedia/archiveMedia/unarchiveMedia/getArchivedMedias/deleteMedia/pinMedia/unpinMedia`
  (лог+detectStatus+maybeDeactivate); `ShowcaseMediaController` (мутации); роуты.
- Vue: `features/edit-media-caption`, `features/toggle-media-archive`, `features/delete-media` (с подтверждением),
  `features/pin-media`; кнопки в `showcase-work-area`; обновление сетки/снимка после мутации.

## Механика и инварианты

- Мутации синхронные (Laravel→Python→IG), без очереди (инвариант §2.6 архитектуры).
- **Save→push→verify:** после мутации фронт перетягивает `/media/{mediaPk}` (или часть сетки) и показывает
  актуальное состояние из IG — доказательство «появилось после refresh».
- **pin ≤3:** перед pin проверять, что закреплённых < 3 (IG-лимит); иначе понятная ошибка в UI.
- **delete необратимо:** модалка-подтверждение + флаг `confirm:true` в теле; overlay помечается осиротевшим.
- **archive:** пост уходит из `user_medias`; overlay остаётся (для возврата). Архив доступен через `/archived`.
- **Классификация ошибок** (как в автоматизации §6.4): `media_not_found`→понятная ошибка без деактивации;
  `rate_limited`/`feedback_required`→не долбить, показать «попробуйте позже»; `login_required`/`challenge`→
  `maybeDeactivateAccount` уже отрабатывает.
- pin/clip: для Reels — `clip_pin`/`clip_unpin` (определять по `media_type`/product_type).

## Чек-лист

- [ ] Python мутации + предсказуемые ошибки + debug_info.
- [ ] Laravel сервис-методы + контроллер (ownership, валидация, confirm для delete) + роуты.
- [ ] FE features (модалки/кнопки/подтверждения) + перетягивание состояния после мутации + лимит pin≤3.
- [ ] eslint/vue-tsc чисто; BE-тесты (ownership 403/404, валидация, ветки ошибок); PY-тесты (контракт ответа).
- [ ] **Live-check (reversible):** edit подписи → refresh показывает новый текст → вернуть; archive→ушёл из
      сетки→unarchive вернул; pin→закрепился→unpin; (delete — только на расходном посте по согласию).
- [ ] **Рестарт воркеров/python** после правок (`docker compose restart python` минимум; queue не задействован).

## Критерий готовности (gate → Phase 4)

Каждая мутация доказанно меняет реальный аккаунт и видна после refresh; необратимые — за подтверждением;
ошибки IG обрабатываются без эскалации/ложной деактивации.

## Делегирование

- **Kiro Opus (max)** — Laravel мутации + контроллер (ветки ошибок, ownership, confirm) и/или Python (точность instagrapi).
- **Kiro Sonnet (max)** — FE features в своём worktree.
- Прогон reversible-мутаций — оркестратор/владелец по debug-protocol.
