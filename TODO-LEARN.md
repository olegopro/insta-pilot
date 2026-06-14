# TODO — Пробелы в знаниях

Темы которые нужно подтянуть или изучить дополнительно.

---

## JavaScript / TypeScript

- **Event Loop** — финальная схема:
  - Call Stack (JS движок) → выполняет весь код
  - Web APIs (браузер) → setTimeout, addEventListener, WebSocket, fetch (HTTP часть)
  - Microtask Queue → Promise.then, await, queueMicrotask, MutationObserver
  - Task Queue (Macrotask) → setTimeout cb, addEventListener cb, WebSocket cb
  - Event Loop → Call Stack пуст? → сначала ВСЕ микротаски → потом ОДНА макротаска
  - `async/await` — это ECMAScript, НЕ Web API. Работает через Microtask Queue без браузера.
  - `fetch` — гибрид: HTTP запрос через Web API, но `.then` callback → Microtask Queue

- **`try/catch`** — ловит только то что выбрасывается в текущем стеке вызовов:
  - ✅ синхронный throw
  - ✅ await Promise.reject (продолжает тот же стек через Microtask)
  - ❌ setTimeout callback (новый пустой стек)
  - ❌ addEventListener callback (новый пустой стек)
  - ❌ echo.listen callback (новый пустой стек)

- **`void` перед Promise** — явно игнорирует возвращаемый Promise, чтобы не было предупреждений TypeScript.

- **`ReturnType<typeof fn>`** — берёт тип возвращаемого значения функции без привязки к окружению.

- **`window.scrollY`** — сколько пикселей прокручено от верха. `scrollHeight` — полная высота страницы включая невидимую часть.

---

## PHP / Laravel

- **`intdiv()`** — целочисленное деление без остатка. `intdiv(51, 2)` → `25`.

- **`??` (null coalescing)** — если левая часть `null`, берётся правая. Альтернатива `if ($x === null)`.

- **`use ($var)` в анонимных функциях** — явный захват переменных из внешней области видимости. В JS это автоматически, в PHP — нет.

- **`DB::transaction(callback)`** — два запроса внутри либо оба выполняются, либо ни один. При ошибке — `rollBack` откатывает всё.

- **`new Model([...])`** в конструкторе — создаёт объект в памяти без сохранения в БД. `save()` потом смотрит на наличие `id`: есть → UPDATE, нет → INSERT.

- **`OFFSET` в SQL** — не пропускает записи, а читает и отбрасывает. На больших таблицах дорого. Альтернатива — курсорная пагинация по `id`.

---

## Разобрать позже (по плану обучения)

- **`echo.listen()`** — аналог `addEventListener`, триггер не клик, а WebSocket-сообщение от бэкенда. Разобрать на **Backend Level 8** (Events и Broadcasting).
