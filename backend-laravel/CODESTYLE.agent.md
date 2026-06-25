# CODE STYLE — backend-laravel (PHP 8.2 + Laravel 13)

> Выжимка форматирования и именования для агента-кодера. Источник правды — `.php-cs-fixer.php`
> (@PSR12 + кастом), `phpcs.xml` (PSR12, line 160), `.editorconfig` и конвенции `backend-laravel/CLAUDE.md`.
> Соблюдать ТОЧНО — код проходит `vendor/bin/php-cs-fixer` и `vendor/bin/phpcs`.

## Форматирование (PHP CS Fixer @PSR12 + кастом)
- **База — PSR-12**, но с отступлениями ниже.
- **Отступ — 4 пробела**, никогда tab. EOL `lf`, charset `utf-8`, финальный перевод строки.
- **Длина строки — ≤160** (phpcs `Generic.Files.LineLength`).
- **Открывающая `{` — НА ТОЙ ЖЕ СТРОКЕ** для классов и функций/методов (отступление от PSR-12):
  `final class Foo {`, `public function bar(): void {`, `interface Baz {`.
- **Массивы — short syntax `[]`**, не `array()`.
- **Trailing comma НЕ ставить** в массивах: `['a', 'b', 'c']`, не `[..., ]`.
- Массив из **2+ элементов — многострочно**, каждый элемент на своей строке.
- **Выравнивание `=>` и `=`** минимальным одиночным пробелом в блоках (`binary_operator_spaces: align_single_space_minimal`).
- **Пустая строка перед `return`** (`blank_line_before_statement`).
- **Без неиспользуемых `use`** (`no_unused_imports`).
- Пустое тело — на одной строке: `{}`. Method chaining — с отступом. Конкатенация `.` допускается без пробелов вокруг.

## Конвенции проекта
- **`declare(strict_types=1);`** в каждом PHP-файле (после `<?php`).
- Контроллеры: **`final class`**; методы экшенов возвращают **только `JsonResponse`**.
- DI — **через конструктор**, свойства `private readonly`.
- Паттерн слоёв: **Interface → Implementation → bind в `AppServiceProvider`** → (опц.) Facade.
- Тесты (`tests/`): имена методов в **snake_case** разрешены (`test_creates_task`), `final class`.
