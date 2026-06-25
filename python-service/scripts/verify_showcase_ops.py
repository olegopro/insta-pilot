#!/usr/bin/env python3
"""
verify_showcase_ops.py — автономный reversible-харнес для Phase 0 фичи «Витрина».

Назначение: на ЖИВОМ аккаунте доказать, что IG-операции «Витрины» (чтение сетки/профиля,
edit подписи, archive/unarchive, pin/unpin, delete) реально работают и сохраняются после
повторного запроса, и зафиксировать ТОЧНУЮ форму ответов instagrapi (особенно флаг pinned
и путь сериализации своих постов).

Скрипт запускается ВРУЧНУЮ, НЕ является частью FastAPI. Rate-limit first: все сетевые вызовы
идут последовательно, с паузами 2..4 с, мутации — только reversible (кроме отдельного
опасного delete-режима за двумя флагами).

Запуск:
    # только чтения (безопасно)
    python scripts/verify_showcase_ops.py /app/_TEST/session.json --read-only
    # reversible round-trip на конкретном посте (после согласия владельца)
    python scripts/verify_showcase_ops.py /app/_TEST/session.json --mutate --media-pk <PK>
    # опасный delete на расходном посте (необратимо!)
    python scripts/verify_showcase_ops.py /app/_TEST/session.json --allow-delete --delete-media-pk <PK>

Спецификация: docs/showcase/phases/phase-0-verify.md
Контракты:    docs/showcase/api-contracts.md, docs/showcase/feasibility.md
"""

import argparse
import json
import os
import random
import sys
import time
import traceback

# ─── Подключение пакета python-service ──────────────────────────────────────────
# Скрипт лежит в python-service/scripts/, а client.py/helpers.py — на уровень выше.
# Добавляем корень пакета в sys.path, чтобы ПЕРЕИСПОЛЬЗОВАТЬ проектные сериализаторы
# (а не дублировать их) — единый снимок формата ответов с боевым кодом.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from instagrapi import Client  # noqa: E402

# Переиспользуем проектные хелперы — тот же путь сериализации, что и в бою.
from helpers import _serialize_media, _fetch_user_medias_raw  # noqa: E402


# ─── Утилиты вывода и пауз ──────────────────────────────────────────────────────

def _header(title: str) -> None:
    """Крупный заголовок секции."""
    print("\n" + "=" * 78)
    print(f"  {title}")
    print("=" * 78)


def _sub(title: str) -> None:
    """Подзаголовок шага."""
    print(f"\n── {title} " + "─" * max(0, 70 - len(title)))


def _dump(label: str, value) -> None:
    """Печатает JSON-представление значения (модели/dict/списки) без падения на не-JSON."""
    try:
        text = json.dumps(value, ensure_ascii=False, indent=2, default=str)
    except (TypeError, ValueError):
        text = repr(value)
    print(f"{label}:\n{text}")


def _pause() -> None:
    """Пауза между сетевыми вызовами (анти-бан, rate-limit first)."""
    delay = random.uniform(2.0, 4.0)
    print(f"   …пауза {delay:.1f}s")
    time.sleep(delay)


def _to_dict(model) -> dict:
    """
    Приводит pydantic-модель instagrapi к dict.
    Поддерживает pydantic v2 (model_dump) и v1 (dict); иначе — vars().
    """
    if isinstance(model, dict):
        return model
    if hasattr(model, "model_dump"):
        return model.model_dump()
    if hasattr(model, "dict"):
        return model.dict()
    return dict(vars(model))


def _find_pinned_keys(data: dict) -> dict:
    """Выбирает из dict все ключи, в названии которых есть 'pin' — для поиска флага закрепления."""
    return {k: v for k, v in data.items() if "pin" in k.lower()}


# ─── Сбор итоговой сводки ───────────────────────────────────────────────────────

class Report:
    """Накопитель результатов: что прошло, что упало, что требует РУЧНОГО отката."""

    def __init__(self) -> None:
        self.results: list[tuple[str, str, str]] = []   # (шаг, статус, заметка)
        self.manual_rollback: list[str] = []            # описания незавершённых откатов

    def ok(self, step: str, note: str = "") -> None:
        self.results.append((step, "OK", note))

    def fail(self, step: str, note: str = "") -> None:
        self.results.append((step, "FAIL", note))

    def warn(self, step: str, note: str = "") -> None:
        self.results.append((step, "WARN", note))

    def needs_rollback(self, desc: str) -> None:
        """Зафиксировать, что мутация НЕ откатилась — владелец вернёт вручную."""
        self.manual_rollback.append(desc)

    def print_summary(self) -> None:
        _header("ИТОГОВАЯ СВОДКА")
        for step, status, note in self.results:
            mark = {"OK": "✓", "FAIL": "✗", "WARN": "⚠"}.get(status, "?")
            line = f"  {mark} [{status}] {step}"
            if note:
                line += f" — {note}"
            print(line)

        if self.manual_rollback:
            print("\n" + "!" * 78)
            print("  ⚠⚠⚠  ТРЕБУЕТСЯ РУЧНОЙ ОТКАТ — мутации НЕ вернулись автоматически:")
            for desc in self.manual_rollback:
                print(f"     • {desc}")
            print("!" * 78)
        else:
            print("\n  Ручной откат не требуется (все reversible-циклы завершились или не запускались).")


# ─── Восстановление клиента (повтор логики client._make_client) ────────────────

def restore_client(session_path: str) -> Client:
    """
    Восстанавливает instagrapi.Client из JSON-файла сессии.

    Повторяет логику client._make_client (без кеша — он здесь не нужен):
    свежий Client + set_settings(session_data). Прокси/девайс уже внутри settings,
    отдельно не задаём. session_data НЕ логируем (только факт загрузки).
    """
    with open(session_path, "r", encoding="utf-8") as f:
        session_data = f.read()

    settings = json.loads(session_data)
    cl = Client()
    cl.set_settings(settings)
    print(f"   Клиент восстановлен из сессии (set_settings). user_id={cl.user_id}")
    return cl


# ─── ЧТЕНИЯ (выполняются всегда) ────────────────────────────────────────────────

def read_profile(cl: Client, uid: str, rep: Report) -> None:
    """user_info(uid) → профиль владельца (counts/bio/private/verified)."""
    _sub("ПРОФИЛЬ: user_info(cl.user_id)")
    try:
        info = cl.user_info(uid)
        d = _to_dict(info)
        print(f"   username:        {d.get('username')}")
        print(f"   full_name:       {d.get('full_name')}")
        print(f"   media_count:     {d.get('media_count')}")
        print(f"   follower_count:  {d.get('follower_count')}")
        print(f"   following_count: {d.get('following_count')}")
        print(f"   is_private:      {d.get('is_private')}")
        print(f"   is_verified:     {d.get('is_verified')}")
        bio = (d.get("biography") or "")
        print(f"   biography:       {bio[:120]}{'…' if len(bio) > 120 else ''}")
        rep.ok("read.profile", f"@{d.get('username')}, media={d.get('media_count')}")
    except Exception as exc:
        print(f"   ✗ user_info упал: {exc}")
        rep.fail("read.profile", str(exc))


def read_medias(cl: Client, uid: str, amount: int, rep: Report) -> list:
    """
    user_medias_paginated(uid, amount) → сетка постов.
    Печатает полный media.dict() ПЕРВОГО поста (ключи+значения) и ищет флаг pinned.
    Возвращает список Media-моделей (для дальнейших сверок).
    """
    _sub(f"СЕТКА: user_medias_paginated(uid, amount={amount})")
    medias: list = []
    try:
        result = cl.user_medias_paginated(uid, amount=amount)
        # instagrapi отдаёт (list[Media], end_cursor) — поддержим и голый список
        if isinstance(result, tuple):
            medias, end_cursor = result[0], (result[1] if len(result) > 1 else None)
        else:
            medias, end_cursor = result, None

        print(f"   получено постов: {len(medias)}")
        print(f"   end_cursor:      {end_cursor!r} (работает ли курсор — см. значение)")

        if medias:
            first = _to_dict(medias[0])
            _dump("\n   ПОЛНЫЙ media.dict() первого поста", first)

            pinned = _find_pinned_keys(first)
            print("\n   >>> Поиск флага закрепления (pinned) в media.dict():")
            print(f"       ключи c 'pin': {pinned if pinned else 'НЕ НАЙДЕНЫ в pydantic-модели'}")
            rep.ok("read.medias", f"{len(medias)} постов; pinned-ключи: {list(pinned.keys()) or 'нет'}")
        else:
            rep.warn("read.medias", "постов не получено")
    except Exception as exc:
        print(f"   ✗ user_medias_paginated упал: {exc}")
        rep.fail("read.medias", str(exc))

    return medias


def read_medias_raw(cl: Client, uid: str, amount: int, rep: Report) -> None:
    """
    Сравнение путей сериализации своих постов:
      A) pydantic media.dict() (см. read_medias выше);
      B) raw private_request feed/user/{uid}/ + проектный _serialize_media
         (тот же путь, что helpers._fetch_user_medias_raw).
    Цель — зафиксировать, какой путь даёт более полные данные + флаг pinned.
    """
    _sub("RAW-СРАВНЕНИЕ: private_request feed/user/{uid}/ vs media.dict()")

    # B1) Сырой ответ — ищем флаг pinned на уровне ленты и первого item.
    try:
        raw = cl.private_request(
            f"feed/user/{uid}/",
            params={"count": amount, "_uuid": cl.uuid},
        )
        feed_pinned = _find_pinned_keys(raw)
        print(f"   feed-level ключи с 'pin': {feed_pinned if feed_pinned else 'нет на уровне ленты'}")

        items = raw.get("items") or [
            it.get("media_or_ad") for it in (raw.get("feed_items") or []) if isinstance(it, dict)
        ]
        items = [it for it in items if it]
        print(f"   raw items: {len(items)}")
        if items:
            first_item = items[0]
            item_pinned = _find_pinned_keys(first_item)
            print(f"   первый raw item — ключи с 'pin': {item_pinned if item_pinned else 'нет'}")
            print(f"   первый raw item — всего ключей: {len(first_item.keys())}")
            print(f"   ключи raw item: {sorted(first_item.keys())}")

        _pause()

        # B2) Проектный путь сериализации (переиспускаем helpers._fetch_user_medias_raw).
        serialized = _fetch_user_medias_raw(cl, uid, amount)
        print(f"\n   helpers._fetch_user_medias_raw → постов: {len(serialized)}")
        if serialized:
            _dump("   первый пост через _serialize_media (проектный формат)", serialized[0])
            has_pin = "is_pinned" in serialized[0]
            print(f"   _serialize_media отдаёт поле is_pinned: {has_pin} "
                  f"(если нет — добавить при выборе этого пути)")

        # Вердикт по выбору пути (эвристика — окончательно фиксирует владелец в api-contracts.md).
        print("\n   >>> ВЕРДИКТ (путь сериализации своих постов):")
        print("       — media.dict() (pydantic): чистые типизированные поля, но pinned обычно НЕ выставлен;")
        print("       — raw feed/user/{pk}/ + _serialize_media: ближе к ленте, но требует ручной")
        print("         выборки pinned из feed-level/ item-level ключей выше.")
        print("       Выбор зафиксировать по фактическому наличию pinned-ключа в выводе выше.")
        rep.ok("read.raw_compare",
               f"raw_items={len(items)}, serialized={len(serialized)}")
    except Exception as exc:
        print(f"   ✗ raw-сравнение упало: {exc}")
        rep.fail("read.raw_compare", str(exc))


def read_media_info(cl: Client, media_pk: str, rep: Report) -> None:
    """media_info_v1(media_pk) → снимок поста; сверяем с элементом сетки."""
    _sub(f"СНИМОК ПОСТА: media_info_v1({media_pk})")
    try:
        media = cl.media_info_v1(media_pk)
        d = _to_dict(media)
        print(f"   pk:            {d.get('pk')}")
        print(f"   code:          {d.get('code')}")
        print(f"   media_type:    {d.get('media_type')}  product_type: {d.get('product_type')}")
        print(f"   like_count:    {d.get('like_count')}  comment_count: {d.get('comment_count')}")
        cap = (d.get("caption_text") or "")
        print(f"   caption_text:  {cap[:120]}{'…' if len(cap) > 120 else ''}")
        pinned = _find_pinned_keys(d)
        print(f"   ключи c 'pin': {pinned if pinned else 'нет'}")
        rep.ok("read.media_info", f"pk={d.get('pk')}, type={d.get('media_type')}")
    except Exception as exc:
        print(f"   ✗ media_info_v1 упал: {exc}")
        rep.fail("read.media_info", str(exc))


# ─── REVERSIBLE-МУТАЦИИ (только при --mutate --media-pk) ─────────────────────────

def _media_caption(cl: Client, media_pk: str) -> str:
    """Текущая подпись поста через media_info_v1 (источник истины для round-trip)."""
    return _to_dict(cl.media_info_v1(media_pk)).get("caption_text") or ""


def mutate_edit(cl: Client, media_pk: str, media_id: str, rep: Report) -> None:
    """
    EDIT round-trip: добавить ' [verify]' к подписи → подтвердить → ВЕРНУТЬ исходную → подтвердить.
    Если правка применилась, а откат — нет, явно помечаем требование ручного возврата.
    """
    _sub("МУТАЦИЯ #1 — EDIT подписи (reversible)")
    edited = False
    try:
        original = _media_caption(cl, media_pk)
        print(f"   ДО:    caption={original[:80]!r}{'…' if len(original) > 80 else ''}")
        _pause()

        new_caption = f"{original} [verify]".strip()
        cl.media_edit(media_id, caption=new_caption)
        edited = True
        _pause()

        after = _media_caption(cl, media_pk)
        persists = (after == new_caption)
        print(f"   ПОСЛЕ: caption={after[:80]!r}{'…' if len(after) > 80 else ''}")
        print(f"   persists (повторный media_info_v1): {'ДА' if persists else 'НЕТ'}")
        _pause()

        # Возврат исходной подписи.
        cl.media_edit(media_id, caption=original)
        edited = False
        _pause()
        reverted = (_media_caption(cl, media_pk) == original)
        print(f"   ОТКАТ: исходная подпись возвращена: {'ДА' if reverted else 'НЕТ'}")

        if persists and reverted:
            rep.ok("mutate.edit", "применилось и откатилось")
        elif not reverted:
            rep.fail("mutate.edit", "откат НЕ подтверждён")
            rep.needs_rollback(f"EDIT: вернуть исходную подпись поста {media_pk}")
        else:
            rep.warn("mutate.edit", "правка не подтвердилась после refetch")
    except Exception as exc:
        print(f"   ✗ EDIT упал: {exc}")
        rep.fail("mutate.edit", str(exc))
        if edited:
            # Упали уже ПОСЛЕ применения правки — откат не выполнен.
            rep.needs_rollback(f"EDIT: подпись поста {media_pk} осталась с ' [verify]' — вернуть вручную")


def mutate_archive(cl: Client, uid: str, media_pk: str, media_id: str, amount: int, rep: Report) -> None:
    """
    ARCHIVE round-trip: archive → проверить уход из user_medias (+ наличие в archive_medias,
    если метод есть) → unarchive → проверить возврат.
    """
    _sub("МУТАЦИЯ #2 — ARCHIVE → UNARCHIVE (reversible)")
    archived = False

    def _pks() -> set[str]:
        res = cl.user_medias_paginated(uid, amount=amount)
        medias = res[0] if isinstance(res, tuple) else res
        return {str(_to_dict(m).get("pk")) for m in medias}

    try:
        before = _pks()
        print(f"   ДО:    пост в user_medias: {'ДА' if media_pk in before else 'НЕТ'}")
        _pause()

        cl.media_archive(media_id)
        archived = True
        _pause()

        after = _pks()
        gone = media_pk not in after
        print(f"   ПОСЛЕ archive: ушёл из user_medias: {'ДА' if gone else 'НЕТ'}")

        # archive_medias может отсутствовать в этой версии instagrapi — мягко пробуем.
        if hasattr(cl, "archive_medias"):
            try:
                _pause()
                arch = cl.archive_medias() if callable(getattr(cl, "archive_medias")) else []
                arch_pks = {str(_to_dict(m).get("pk")) for m in (arch or [])}
                print(f"   в archive_medias: {'ДА' if media_pk in arch_pks else 'НЕТ'} "
                      f"(всего в архиве: {len(arch_pks)})")
            except Exception as e_arch:
                print(f"   archive_medias недоступен/упал: {e_arch}")
        else:
            print("   archive_medias: метода нет в instagrapi — проверка только через user_medias")
        _pause()

        cl.media_unarchive(media_id)
        archived = False
        _pause()
        restored = media_pk in _pks()
        print(f"   ОТКАТ: вернулся в user_medias: {'ДА' if restored else 'НЕТ'}")

        if gone and restored:
            rep.ok("mutate.archive", "archive скрыл, unarchive вернул")
        elif not restored:
            rep.fail("mutate.archive", "возврат НЕ подтверждён")
            rep.needs_rollback(f"ARCHIVE: пост {media_pk} остался в архиве — unarchive вручную")
        else:
            rep.warn("mutate.archive", "archive не отразился уходом из сетки")
    except Exception as exc:
        print(f"   ✗ ARCHIVE упал: {exc}")
        rep.fail("mutate.archive", str(exc))
        if archived:
            rep.needs_rollback(f"ARCHIVE: пост {media_pk} в архиве — выполнить unarchive вручную")


def mutate_pin(cl: Client, media_pk: str, media_id: str, rep: Report) -> None:
    """
    PIN round-trip: pin → проверить отражение закрепления → unpin → проверить возврат.
    Для Reels/clip используем clip_pin/clip_unpin. Пробуем сигнатуру по media_pk,
    при ошибке — фолбэк на media_id (нестабильность сигнатур instagrapi).
    """
    _sub("МУТАЦИЯ #3 — PIN → UNPIN (reversible)")
    pinned = False
    try:
        info = _to_dict(cl.media_info_v1(media_pk))
        is_clip = info.get("product_type") == "clips" or (
            info.get("media_type") == 2 and info.get("product_type") in ("clips", "igtv")
        )
        pin_name = "clip_pin" if is_clip else "media_pin"
        unpin_name = "clip_unpin" if is_clip else "media_unpin"
        print(f"   тип поста: media_type={info.get('media_type')} product_type={info.get('product_type')} "
              f"→ методы: {pin_name}/{unpin_name}")

        pin_fn = getattr(cl, pin_name, None)
        unpin_fn = getattr(cl, unpin_name, None)
        if not pin_fn or not unpin_fn:
            print(f"   ✗ методы {pin_name}/{unpin_name} отсутствуют в instagrapi")
            rep.fail("mutate.pin", f"{pin_name}/{unpin_name} нет")
            return

        before = _find_pinned_keys(info)
        print(f"   ДО:    pinned-ключи: {before if before else 'нет'}")
        _pause()

        # Сначала по media_pk (как в спеке/feasibility), при TypeError/ошибке — по media_id.
        try:
            pin_fn(media_pk)
        except Exception:
            pin_fn(media_id)
        pinned = True
        _pause()

        after = _find_pinned_keys(_to_dict(cl.media_info_v1(media_pk)))
        print(f"   ПОСЛЕ pin: pinned-ключи: {after if after else 'нет (флаг мог не прийти в media_info)'}")
        _pause()

        try:
            unpin_fn(media_pk)
        except Exception:
            unpin_fn(media_id)
        pinned = False
        _pause()
        final = _find_pinned_keys(_to_dict(cl.media_info_v1(media_pk)))
        print(f"   ОТКАТ: pinned-ключи: {final if final else 'нет'}")
        rep.ok("mutate.pin", "pin/unpin прошли без ошибок (отражение флага — см. вывод)")
    except Exception as exc:
        print(f"   ✗ PIN упал: {exc}")
        rep.fail("mutate.pin", str(exc))
        if pinned:
            rep.needs_rollback(f"PIN: пост {media_pk} остался закреплён — unpin вручную")


# ─── DELETE (только при --allow-delete --delete-media-pk) ────────────────────────

def dangerous_delete(cl: Client, uid: str, media_pk: str, media_id: str, amount: int, rep: Report) -> None:
    """НЕОБРАТИМОЕ удаление расходного поста — только по двум явным флагам."""
    _header("⚠⚠⚠  ОПАСНЫЙ РЕЖИМ: DELETE — ЭТО НЕОБРАТИМО  ⚠⚠⚠")
    print(f"   Целевой пост: media_pk={media_pk} (media_id={media_id})")
    print("   Пост будет УДАЛЁН из аккаунта без возможности автоматического возврата.")
    try:
        cl.media_delete(media_id)
        _pause()
        res = cl.user_medias_paginated(uid, amount=amount)
        medias = res[0] if isinstance(res, tuple) else res
        gone = media_pk not in {str(_to_dict(m).get("pk")) for m in medias}
        print(f"   исчез из user_medias: {'ДА' if gone else 'НЕТ (проверить вручную)'}")
        rep.ok("delete", "пост удалён" if gone else "вызван, но всё ещё в сетке")
    except Exception as exc:
        print(f"   ✗ DELETE упал: {exc}")
        rep.fail("delete", str(exc))


# ─── INSIGHTS-проба (ожидаемо падает на личном аккаунте) ─────────────────────────

def probe_insights(cl: Client, rep: Report) -> None:
    """
    insights_media_feed_all(count=1) в try/except.
    На личном (не бизнес/проф) аккаунте ожидаемо падает — это подтверждает, что
    аналитика личного аккаунта = только публичные счётчики (counts-lite).
    """
    _sub("INSIGHTS-проба: insights_media_feed_all(count=1)")
    try:
        data = cl.insights_media_feed_all(count=1)
        print("   insights ВЕРНУЛИСЬ (аккаунт, похоже, бизнес/проф):")
        _dump("   insights", data)
        rep.warn("insights", "доступны — вероятно бизнес/проф-аккаунт")
    except Exception as exc:
        print(f"   insights упали (ОЖИДАЕМО для личного аккаунта): {exc}")
        rep.ok("insights", "недоступны на личном аккаунте — counts-lite подтверждён")


# ─── CLI / main ─────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Phase 0 reversible-харнес проверки IG-операций «Витрины».",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("session_json", help="путь к JSON-файлу сессии (как _TEST/session.json)")
    p.add_argument("--read-only", action="store_true",
                   help="только чтения (включено по умолчанию, если не задан --mutate)")
    p.add_argument("--mutate", action="store_true",
                   help="включить reversible round-trip (требует --media-pk)")
    p.add_argument("--media-pk", help="целевой пост (media_pk) для reversible-мутаций")
    p.add_argument("--allow-delete", action="store_true",
                   help="разрешить НЕОБРАТИМЫЙ delete (требует --delete-media-pk)")
    p.add_argument("--delete-media-pk", help="расходный пост для проверки delete")
    p.add_argument("--amount", type=int, default=12, help="сколько постов тянуть (default 12)")
    return p


def main() -> int:
    args = build_parser().parse_args()
    rep = Report()

    # Валидация флагов.
    if args.mutate and not args.media_pk:
        print("✗ --mutate требует --media-pk <PK>")
        return 2
    if args.allow_delete and not args.delete_media_pk:
        print("✗ --allow-delete требует --delete-media-pk <PK>")
        return 2
    if not os.path.isfile(args.session_json):
        print(f"✗ файл сессии не найден: {args.session_json}")
        return 2

    # По умолчанию — read-only, если не запрошена мутация/delete.
    do_mutate = args.mutate
    do_delete = args.allow_delete
    read_only = not (do_mutate or do_delete) or args.read_only

    _header("VERIFY SHOWCASE OPS — Phase 0")
    print(f"   session:     {args.session_json}")
    print(f"   режим:       {'READ-ONLY' if not (do_mutate or do_delete) else ''}"
          f"{' +MUTATE' if do_mutate else ''}{' +DELETE' if do_delete else ''}".strip())
    print(f"   amount:      {args.amount}")
    if do_mutate:
        print(f"   media_pk:    {args.media_pk}")
    if do_delete:
        print(f"   delete_pk:   {args.delete_media_pk}")

    # ── Восстановление клиента ──
    _header("ВОССТАНОВЛЕНИЕ КЛИЕНТА")
    try:
        cl = restore_client(args.session_json)
        uid = str(cl.user_id)
        if not uid or uid == "None":
            print("✗ user_id не определён из сессии — сессия протухла?")
            rep.fail("restore", "нет user_id")
            rep.print_summary()
            return 1
        rep.ok("restore", f"user_id={uid}")
    except Exception as exc:
        print(f"✗ не удалось восстановить клиент: {exc}")
        traceback.print_exc()
        rep.fail("restore", str(exc))
        rep.print_summary()
        return 1

    # ── ЧТЕНИЯ (всегда) ──
    _header("ЧТЕНИЯ (read-only)")
    read_profile(cl, uid, rep)
    _pause()
    medias = read_medias(cl, uid, args.amount, rep)
    _pause()
    read_medias_raw(cl, uid, args.amount, rep)

    # media_pk для снимка: явный --media-pk либо первый пост сетки.
    snapshot_pk = args.media_pk
    if not snapshot_pk and medias:
        snapshot_pk = str(_to_dict(medias[0]).get("pk"))
    if snapshot_pk:
        _pause()
        read_media_info(cl, snapshot_pk, rep)

    # ── INSIGHTS-проба ──
    _pause()
    probe_insights(cl, rep)

    # ── REVERSIBLE-МУТАЦИИ ──
    if do_mutate:
        media_pk = str(args.media_pk)
        media_id = f"{media_pk}_{uid}"  # media_id = {media_pk}_{owner_user_pk}
        _header("REVERSIBLE-МУТАЦИИ (--mutate)")
        print(f"   media_pk={media_pk}  media_id={media_id}")
        _pause()
        mutate_edit(cl, media_pk, media_id, rep)
        _pause()
        mutate_archive(cl, uid, media_pk, media_id, args.amount, rep)
        _pause()
        mutate_pin(cl, media_pk, media_id, rep)

    # ── DELETE (опасный, отдельно) ──
    if do_delete:
        del_pk = str(args.delete_media_pk)
        del_id = f"{del_pk}_{uid}"
        _pause()
        dangerous_delete(cl, uid, del_pk, del_id, args.amount, rep)

    rep.print_summary()

    # Ненулевой код выхода, если что-то упало или требует ручного отката.
    failed = any(s == "FAIL" for _, s, _ in rep.results)
    return 1 if (failed or rep.manual_rollback) else 0


if __name__ == "__main__":
    sys.exit(main())
