# CODE STYLE — frontend-vue (Vue 3 + Quasar + TS)

> Выжимка форматирования и именования для агента-кодера. Источник правды — `eslint.config.js`
> (@stylistic + vue + vue-ts strictTypeChecked), `.prettierrc.json`, `.editorconfig`, `tsconfig.json`
> и конвенции `frontend-vue/CLAUDE.md`. Соблюдать ТОЧНО — код проходит `npm run lint`.

## Форматирование (ESLint @stylistic / Prettier)
- **Отступ — 2 пробела**, никогда tab. В `switch` блок `case` — +1 уровень.
- **Кавычки — одинарные** `'...'`. Двойные только если внутри строки есть одинарная (avoidEscape).
- **Точку с запятой НЕ ставить** (`semi: never`). Конец стейтмента — перевод строки.
- **Trailing comma НЕ ставить НИГДЕ** (`comma-dangle: never`) — ни в многострочных массивах/объектах,
  ни даже для единственного свойства: `{ a: 1 }`, а не `{ a: 1, }`.
- **Длина строки — 100** (Prettier `printWidth`). Длиннее — переносить.
- Пробелы вокруг `=>`. Максимум 2 пустые строки подряд. Финальный перевод строки обязателен. EOL `lf`, charset `utf-8`.

## Стрелочные функции
- **Скобки вокруг аргумента — всегда**: `(x) => ...`, не `x => ...`.
- **Тело без `{}`, если это один expression** (enforced `local/arrow-concise-body`):
  `const f = (x) => x + 1` — НЕ `const f = (x) => { return x + 1 }`.
  Объект в concise body оборачивать в скобки: `(x) => ({ id: x })`.
- Параметры callback — **полные имена**, без однобуквенных: `(response) =>`, `(account) =>` — не `(r)`, `(a)`, `(e)`.
- `&&` вместо короткого `if`: `opened && fetchData()`.

## Импорты и типы (TS strict)
- **Только алиас `@/...`**, относительные импорты (`./`, `../`) ЗАПРЕЩЕНЫ (`no-relative-import-paths`).
- **Импорт типов через `import type`** (`consistent-type-imports`): `import type { MediaPostApi } from '@/...'`.
- tsconfig строгий (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`): проверять `undefined` у индексного
  доступа, не подавлять типы через `any`.
- Naming типов: API-типы (snake_case-поля) — суффикс `Api` (`MediaPostApi`), файл `apiTypes.ts`; локальные
  (camelCase) — без суффикса, файл `types.ts`; DTO — класс-синглтон `*DTO.ts`. **`Nullable<T>` вместо `T | null`.**

## Vue SFC
- Порядок блоков: **`<script setup lang="ts">` → `<template>` → `<style>`**.
- `vue/script-indent` base 1, `vue/html-indent` base 1 (отступ 2 пробела).
- `vue/require-explicit-emits` — все эмиты объявлять явно. Соблюдать `vue/attributes-order`.
- Хуки жизненного цикла (`onMounted` и т.п.) — **в самом конце** `<script setup>`.
- В `<template>` НИКОГДА не писать `.value`; обращение к стору `store.*` — тоже без `.value`.

## Именование
- Обработчики событий — суффикс **`Handler`**: `submitHandler`, `deleteHandler`.
- UI-обёртки над Quasar (в `shared/ui/`) — суффикс **`Component`**; папки компонентов — **kebab-case** (`button-component/`).
