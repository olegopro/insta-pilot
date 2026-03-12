import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { User } from '@/entities/user/model/types'

vi.mock('@/boot/axios', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn()
  }
}))

import { api } from '@/boot/axios'
import { useAuthStore } from '@/entities/user/model/authStore'

const mockUser: User = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  is_active: true,
  roles: [{ id: 1, name: 'user', guard_name: 'web' }],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
}

const mockAdminUser: User = {
  ...mockUser,
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
      data: { success: true, data: { user: mockUser, token: 'test-token' }, message: 'OK' }
    })

    const store = useAuthStore()
    await store.login({ email: 'test@example.com', password: 'password' })

    expect(localStorage.getItem('token')).toBe('test-token')
  })

  it('login сохраняет user в store', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, data: { user: mockUser, token: 'test-token' }, message: 'OK' }
    })

    const store = useAuthStore()
    await store.login({ email: 'test@example.com', password: 'password' })

    expect(store.user).toEqual(mockUser)
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
      data: { success: true, data: { user: mockUser, token: 'test-token' }, message: 'OK' }
    })

    const store = useAuthStore()
    await store.login({ email: 'test@example.com', password: 'password' })

    expect(store.isAuthenticated).toBe(true)
  })

  it('isAdmin = false для роли user', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, data: { user: mockUser, token: 'test-token' }, message: 'OK' }
    })

    const store = useAuthStore()
    await store.login({ email: 'test@example.com', password: 'password' })

    expect(store.isAdmin).toBe(false)
  })

  it('isAdmin = true для роли admin', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: { user: mockAdminUser, token: 'admin-token' },
        message: 'OK'
      }
    })

    const store = useAuthStore()
    await store.login({ email: 'admin@example.com', password: 'password' })

    expect(store.isAdmin).toBe(true)
  })
})
