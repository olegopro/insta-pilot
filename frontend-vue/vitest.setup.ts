import { vi } from 'vitest'

// laravel-echo (>=2.3.x) сразу открывает Reverb/Pusher-соединение при импорте
// echo.ts, что падает под happy-dom (window.Pusher interop). Подменяем echo-синглтон
// заглушкой для unit-тестов — продакшн-код не трогаем.
vi.mock('@/shared/lib/echo', () => {
  const channel: Record<string, (...args: unknown[]) => unknown> = {}
  // Любой вызов метода канала (listen, stopListening, error, ...) возвращает сам канал
  const chainable = new Proxy(channel, { get: () => () => chainable })
  return {
    echo: {
      private: () => chainable,
      channel: () => chainable,
      leave: () => undefined,
      leaveChannel: () => undefined,
      disconnect: () => undefined
    }
  }
})
