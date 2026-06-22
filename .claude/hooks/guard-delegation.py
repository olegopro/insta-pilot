#!/usr/bin/env python3
"""PreToolUse-страж делегирования insta-pilot.

Блокирует ПРЯМУЮ правку (Edit/Write/MultiEdit) главной модели в зонах реализации —
их пишет Kiro-делегат, не оркестратор. Швы, shared-слой, доки и конфиги — разрешены.
Внешние процессы (Kiro через MCP) хук НЕ перехватывает, поэтому делегатам не мешает.

Контракт: stdin = JSON PreToolUse (tool_name, tool_input.file_path, cwd, ...).
Решение deny отдаётся JSON-ом на stdout с exit 0 (permissionDecisionReason видна модели).
Любая неясность (не распарсилось, нет пути, путь вне проекта) → молча allow (exit 0).
"""

import json
import os
import sys

# Зоны реализации: префиксы относительного POSIX-пути от корня проекта.
DENY_PREFIXES = (
    "frontend-vue/src/pages/",
    "frontend-vue/src/widgets/",
    "frontend-vue/src/entities/",
    "frontend-vue/src/features/",
    "frontend-vue/src/stores/",
)


def denied_zone(rel: str) -> str | None:
    """Вернуть человекочитаемую зону, если путь под запретом, иначе None."""
    for prefix in DENY_PREFIXES:
        if rel.startswith(prefix):
            return prefix.rstrip("/")
    # Вся бизнес-логика Laravel app/ — кроме Providers (это шов, его правит оркестратор).
    if rel.startswith("backend-laravel/app/") and not rel.startswith("backend-laravel/app/Providers/"):
        return "backend-laravel/app (кроме Providers)"
    # Python-сервис: любой .py-код, кроме окружения venv.
    if rel.startswith("python-service/") and rel.endswith(".py") and not rel.startswith("python-service/venv/"):
        return "python-service (*.py)"
    return None


def deny(rel: str, zone: str) -> None:
    """Отдать deny с причиной-инструкцией и завершиться (exit 0 — JSON парсится)."""
    reason = (
        f"Прямая правка реализации запрещена политикой делегирования "
        f"(insta-pilot/CLAUDE.md → «Делегирование исполнителям»). "
        f"Путь «{rel}» — зона «{zone}»: её пишет Kiro-делегат, не главная модель.\n"
        f"Делегируй: mcp__kiro-cli__delegate(task, workdir) — новая единица; "
        f"mcp__kiro-cli__reply(session_id, task, workdir) — продолжить ту же сессию "
        f"(в т.ч. точечные правки по итогам ревью).\n"
        f"Сам правишь только швы (src/router, src/layouts, routes/, app/Providers, "
        f"channels.php), shared-слой, доки и конфиги."
    )
    out = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }
    print(json.dumps(out, ensure_ascii=False))
    sys.exit(0)


def main() -> None:
    try:
        data = json.loads(sys.stdin.read())
    except Exception:
        sys.exit(0)  # не распарсилось — не вмешиваемся

    tool_input = data.get("tool_input") or {}
    # У Edit/Write/MultiEdit путь лежит в file_path; path — страховочный фолбэк.
    file_path = tool_input.get("file_path") or tool_input.get("path") or ""
    if not file_path:
        sys.exit(0)

    root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    abs_path = file_path if os.path.isabs(file_path) else os.path.join(root, file_path)
    abs_path = os.path.normpath(abs_path)
    try:
        rel = os.path.relpath(abs_path, root).replace(os.sep, "/")
    except Exception:
        sys.exit(0)
    if rel.startswith("../"):
        sys.exit(0)  # вне корня проекта — не наша зона

    zone = denied_zone(rel)
    if zone:
        deny(rel, zone)
    sys.exit(0)


if __name__ == "__main__":
    main()
