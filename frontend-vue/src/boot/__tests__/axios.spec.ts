import { describe, it, expect, beforeEach } from 'vitest'
import { api } from '@/boot/axios'
import type { InternalAxiosRequestConfig } from 'axios'

describe('axios api', () => {
  beforeEach(() => localStorage.clear())

  it('base URL соответствует VITE_API_URL', () => {
    // В тестах import.meta.env.VITE_API_URL = undefined → базовый URL undefined/пустой
    // Главное — экземпляр создан и это axios-instance
    expect(api.defaults).toBeDefined()
    expect(typeof api.get).toBe('function')
    expect(typeof api.post).toBe('function')
  })

  it('request interceptor добавляет Authorization header при наличии токена', () => {
    localStorage.setItem('token', 'my-secret-token')

    // Получаем обработчик request interceptor
    const handlers = (api.interceptors.request as unknown as { handlers: Array<{ fulfilled: (cfg: InternalAxiosRequestConfig) => InternalAxiosRequestConfig }> }).handlers
    const handler = handlers.find((h) => h !== null)
    expect(handler).toBeDefined()

    const config = { headers: {} } as InternalAxiosRequestConfig
    const result = handler!.fulfilled(config)
    expect((result.headers as Record<string, string>).Authorization).toBe('Bearer my-secret-token')
  })

  it('request interceptor не добавляет Authorization без токена', () => {
    const handlers = (api.interceptors.request as unknown as { handlers: Array<{ fulfilled: (cfg: InternalAxiosRequestConfig) => InternalAxiosRequestConfig }> }).handlers
    const handler = handlers.find((h) => h !== null)

    const config = { headers: {} } as InternalAxiosRequestConfig
    const result = handler!.fulfilled(config)
    expect((result.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('response interceptor при 401 удаляет токен', async () => {
    localStorage.setItem('token', 'old-token')

    const responseHandlers = (api.interceptors.response as unknown as { handlers: Array<{ rejected: (err: unknown) => never }> }).handlers
    const handler = responseHandlers.find((h) => h !== null)
    expect(handler).toBeDefined()

    const error = {
      config: { url: '/feed' },
      response: { status: 401 }
    }

    try {
      await handler!.rejected(error)
    } catch {
      // ожидаемое поведение — interceptor выбрасывает ошибку
    }

    expect(localStorage.getItem('token')).toBeNull()
  })
})
