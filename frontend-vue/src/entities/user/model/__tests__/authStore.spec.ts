import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { UserApi } from '@/entities/user/model/apiTypes'

vi.mock('@/boot/axios', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn()
  }
}))

import { api } from '@/boot/axios'
import { useAuthStore } from '@/entities/user/model/authStore'

const mockUserApi: UserApi = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  is_active: true,
  roles: [{ id: 1, name: 'user', guard_name: 'web' }],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
}

const mockAdminUserApi: UserApi = {
  ...mockUserApi,
  roles: [{ id: 2, name: 'admin', guard_name: 'web' }]
}

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('login сохраняет токен в localStorage', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, data: { user: mockUserApi, token: 'test-token' }, message: 'OK' }
    })

    const store = useAuthStore()
    await store.login({ email: 'test@example.com', password: 'password' })

    expect(localStorage.getItem('token')).toBe('test-token')
  })

  it('login сохраняет user в store (camelCase)', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, data: { user: mockUserApi, token: 'test-token' }, message: 'OK' }
    })

    const store = useAuthStore()
    await store.login({ email: 'test@example.com', password: 'password' })

    expect(store.user).toMatchObject({
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      isActive: true,
      roles: [{ id: 1, name: 'user', guardName: 'web' }]
    })
  })

  it('logout удаляет токен из localStorage', async () => {
    localStorage.setItem('token', 'existing-token')
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, data: null, message: 'OK' }
    })

    const store = useAuthStore()
    await store.logout()

    expect(localStorage.getItem('token')).toBeNull()
  })

  it('logout обнуляет user', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, data: null, message: 'OK' }
    })

    const store = useAuthStore()
    await store.logout()

    expect(store.user).toBeNull()
  })

  it('clearAuth обнуляет user и удаляет токен', () => {
    localStorage.setItem('token', 'some-token')

    const store = useAuthStore()
    store.clearAuth()

    expect(store.user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('isAuthenticated = false при null user', () => {
    const store = useAuthStore()

    expect(store.isAuthenticated).toBe(false)
  })

  it('isAuthenticated = true после login', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, data: { user: mockUserApi, token: 'test-token' }, message: 'OK' }
    })

    const store = useAuthStore()
    await store.login({ email: 'test@example.com', password: 'password' })

    expect(store.isAuthenticated).toBe(true)
  })

  it('isAdmin = false для роли user', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, data: { user: mockUserApi, token: 'test-token' }, message: 'OK' }
    })

    const store = useAuthStore()
    await store.login({ email: 'test@example.com', password: 'password' })

    expect(store.isAdmin).toBe(false)
  })

  it('isAdmin = true для роли admin', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: { user: mockAdminUserApi, token: 'admin-token' },
        message: 'OK'
      }
    })

    const store = useAuthStore()
    await store.login({ email: 'admin@example.com', password: 'password' })

    expect(store.isAdmin).toBe(true)
  })

  it('login при ошибке выбрасывает исключение и не сохраняет токен', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Unauthorized'))

    const store = useAuthStore()

    await expect(store.login({ email: 'bad@example.com', password: 'wrong' })).rejects.toThrow()
    expect(localStorage.getItem('token')).toBeNull()
    expect(store.user).toBeNull()
  })

  it('loginError содержит сообщение после неудачного login', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Неверный пароль'))

    const store = useAuthStore()
    await expect(store.login({ email: 'bad@example.com', password: 'wrong' })).rejects.toThrow()

    expect(store.loginError).toBeTruthy()
  })

  it('fetchMe загружает пользователя из /auth/me', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { success: true, data: mockUserApi, message: 'OK' }
    })

    const store = useAuthStore()
    await store.fetchMe()

    expect(store.user).toMatchObject({ id: 1, email: 'test@example.com' })
  })

  it('fetchMe при ошибке выбрасывает исключение', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Unauthorized'))

    const store = useAuthStore()

    await expect(store.fetchMe()).rejects.toThrow()
    expect(store.user).toBeNull()
  })
})
