#!/usr/bin/env python
"""
Тест пагинации Instagram Timeline Feed (через штатный instagrapi >= 2.10.5).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ШАГ 0 — Получить session JSON из БД через artisan tinker
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    docker compose exec laravel php artisan tinker

Внутри tinker (замени ID на нужный):

    $id = 3;
    $a = \\App\\Models\\InstagramAccount::find($id);
    file_put_contents(
        base_path("../python-service/session_{$id}.json"),
        json_encode(json_decode($a->session_data, true), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
    );

Файл окажется в python-service/session_{id}.json (он же /app внутри контейнера python).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ШАГ 1 — Запустить тест
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ВАЖНО: instagrapi 2.10.5 требует Python >= 3.10. Локальный venv (3.9) не подходит —
запускай внутри контейнера python (там Python 3.12):

    docker compose run --rm python python test_feed_pagination.py session_3.json --pages 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Алгоритм
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Первый запрос — cold_start_fetch через get_timeline_feed()
  2. Накопить seen_posts (media_id вида {pk}_{user_pk}) из ответа
  3. Следующие страницы — get_timeline_feed(max_id=..., seen_posts=...).
     Метод сам форсит reason="pagination" и собирает feed_view_info из seen_posts.
  4. Проверить, что посты не повторяются между страницами.

2.10.5 (фикс #1789) добавил параметры seen_posts/feed_view_info в get_timeline_feed.
Без seen_posts сервер не знает, что уже показано, и возвращает те же посты. Передаём
seen_posts явно, потому что клиент в сервисе пересоздаётся из сессии между запросами
и на внутренний self._timeline_seen_posts полагаться нельзя.
"""

import argparse
import json
import random
import sys
import time

from instagrapi import Client


# ─── CLI ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Test Instagram timeline feed pagination")
parser.add_argument("session_file", help="Path to session JSON file (exported from DB)")
parser.add_argument("--pages", type=int, default=3, help="Number of pages to fetch (default: 3)")
parser.add_argument("--delay-min", type=float, default=3.0, help="Min delay between pages, seconds")
parser.add_argument("--delay-max", type=float, default=7.0, help="Max delay between pages, seconds")
args = parser.parse_args()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def extract_medias(feed_items: list) -> list:
    """Извлечь только media_or_ad элементы из feed_items."""
    return [item["media_or_ad"] for item in feed_items if "media_or_ad" in item]


def get_media_id(media: dict) -> str:
    """Получить media_id в формате pk_userpk."""
    media_id = media.get("id")
    if not media_id:
        pk = str(media.get("pk", ""))
        user_pk = str(media.get("user", {}).get("pk", ""))
        media_id = f"{pk}_{user_pk}"
    return media_id


def print_medias(medias: list) -> None:
    for media in medias:
        user = media.get("user", {}).get("username", "?")
        pk = media.get("pk", "?")
        caption = (media.get("caption") or {}).get("text", "") or ""
        print(f"  @{user} pk={pk} — {caption[:60]!r}")


# ─── Main ─────────────────────────────────────────────────────────────────────

print(f"Загружаем сессию из {args.session_file}...")
try:
    with open(args.session_file) as f:
        session_data = json.load(f)
except FileNotFoundError:
    print(f"Файл не найден: {args.session_file}")
    print("Смотри инструкцию в начале этого файла (ШАГ 0).")
    sys.exit(1)

cl = Client()
cl.set_settings(session_data)
cl.delay_range = [1, 3]
print(f"Клиент: uuid={cl.uuid[:8]}... phone_id={cl.phone_id[:8]}...")

# Накопленное состояние
all_pks: set[str] = set()
seen_posts: list[str] = []
next_max_id: str | None = None

# ── Страница 1: cold_start_fetch ──────────────────────────────────────────────
print("\n" + "="*60)
print("Страница 1 — cold_start_fetch")
print("="*60)

resp = cl.get_timeline_feed("cold_start_fetch")
page_medias = extract_medias(resp.get("feed_items", []))
print(f"Получено постов: {len(page_medias)}, next_max_id длина: {len(str(resp.get('next_max_id', '')))}")
print_medias(page_medias)

for media in page_medias:
    pk = str(media.get("pk", ""))
    if pk in all_pks:
        print(f"  ⚠️  ДУБЛЬ на странице 1: pk={pk}")
    all_pks.add(pk)
    seen_posts.append(get_media_id(media))

next_max_id = resp.get("next_max_id")

# ── Страницы 2..N: pagination ─────────────────────────────────────────────────
for page in range(2, args.pages + 1):
    if not next_max_id:
        print("\nnext_max_id отсутствует — данные закончились")
        break

    delay = random.uniform(args.delay_min, args.delay_max)
    print(f"\n{'='*60}")
    print(f"Страница {page} — pagination (пауза {delay:.1f}с...)")
    print("="*60)
    time.sleep(delay)

    # seen_posts передаём явно — instagrapi сам форсит reason="pagination"
    # и генерирует feed_view_info из этого списка.
    resp = cl.get_timeline_feed(max_id=next_max_id, seen_posts=seen_posts)

    page_medias = extract_medias(resp.get("feed_items", []))
    print(f"Получено постов: {len(page_medias)}, next_max_id длина: {len(str(resp.get('next_max_id', '')))}")

    duplicates = []
    new_count = 0
    for media in page_medias:
        pk = str(media.get("pk", ""))
        if pk in all_pks:
            duplicates.append(pk)
        else:
            new_count += 1
            all_pks.add(pk)
        seen_posts.append(get_media_id(media))

    print_medias(page_medias)

    if duplicates:
        print(f"\n  ⚠️  ДУБЛЕЙ: {len(duplicates)} — pk={duplicates}")
    else:
        print(f"\n  ✅ Все {new_count} постов — новые, дублей нет")

    next_max_id = resp.get("next_max_id")

# ── Итог ──────────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"Итого уникальных постов: {len(all_pks)} за {min(page, args.pages)} страниц")
