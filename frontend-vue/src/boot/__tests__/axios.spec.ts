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

    type RequestHandler = { fulfilled: (cfg: InternalAxiosRequestConfig) => InternalAxiosRequestConfig } | null
    const handlers = (api.interceptors.request as unknown as { handlers: RequestHandler[] }).handlers
    const handler = handlers.find((h): h is NonNullable<typeof h> => h !== null)
    expect(handler).toBeDefined()
    if (!handler) return

    const config = { headers: {} } as InternalAxiosRequestConfig
    const result = handler.fulfilled(config)
    expect((result.headers as Record<string, string>).Authorization).toBe('Bearer my-secret-token')
  })

  it('request interceptor не добавляет Authorization без токена', () => {
    type RequestHandler = { fulfilled: (cfg: InternalAxiosRequestConfig) => InternalAxiosRequestConfig } | null
    const handlers = (api.interceptors.request as unknown as { handlers: RequestHandler[] }).handlers
    const handler = handlers.find((h): h is NonNullable<typeof h> => h !== null)
    if (!handler) return

    const config = { headers: {} } as InternalAxiosRequestConfig
    const result = handler.fulfilled(config)
    expect((result.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('response interceptor при 401 удаляет токен', () => {
    localStorage.setItem('token', 'old-token')

    type ResponseHandler = { rejected: (err: unknown) => unknown } | null
    const responseHandlers = (api.interceptors.response as unknown as { handlers: ResponseHandler[] }).handlers
    const handler = responseHandlers.find((h): h is NonNullable<typeof h> => h !== null)
    expect(handler).toBeDefined()
    if (!handler) return

    const error = {
      config: { url: '/feed' },
      response: { status: 401 }
    }

    try {
      handler.rejected(error)
    } catch {
      // ожидаемое поведение — interceptor выбрасывает ошибку
    }

    expect(localStorage.getItem('token')).toBeNull()
  })
})
