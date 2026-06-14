import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

vi.mock('@/entities/user', () => ({
  useAuthStore: vi.fn()
}))

import { authGuard } from '@/router/guard'
import routes from '@/router/routes'
import { useAuthStore } from '@/entities/user'

const mockFetchMe = vi.fn()
const mockClearAuth = vi.fn()

const makeAuthStore = (overrides: Record<string, unknown> = {}) => ({
  user:      null,
  isAdmin:   false,
  fetchMe:   mockFetchMe,
  clearAuth: mockClearAuth,
  ...overrides
})

// guard читает только to.meta — остальное навигационному guard'у не нужно
const toWithMeta = (meta: Record<string, unknown>) => ({ meta }) as unknown as RouteLocationNormalized

const setAuthStore = (overrides: Record<string, unknown> = {}) =>
  vi.mocked(useAuthStore).mockReturnValue(makeAuthStore(overrides) as unknown as ReturnType<typeof useAuthStore>)

describe('authGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('неаутентифицированный → redirect на /login для requiresAuth маршрута', async () => {
    setAuthStore()

    const result = await authGuard(toWithMeta({ requiresAuth: true }))

    expect(result).toEqual({ path: '/login' })
  })

  it('аутентифицированный + requiresGuest → redirect на /', async () => {
    localStorage.setItem('token', 'valid-token')
    setAuthStore({ user: { id: 1 } })

    const result = await authGuard(toWithMeta({ requiresGuest: true }))

    expect(result).toEqual({ path: '/' })
  })

  it('не-admin + requiresAdmin → redirect на /', async () => {
    localStorage.setItem('token', 'valid-token')
    setAuthStore({ user: { id: 1 }, isAdmin: false })

    const result = await authGuard(toWithMeta({ requiresAuth: true, requiresAdmin: true }))

    expect(result).toEqual({ path: '/' })
  })

  it('admin + requiresAdmin → пропускает без redirect', async () => {
    localStorage.setItem('token', 'valid-token')
    setAuthStore({ user: { id: 1 }, isAdmin: true })

    const result = await authGuard(toWithMeta({ requiresAuth: true, requiresAdmin: true }))

    expect(result).toBeUndefined()
  })

  it('токен есть, user не загружен → вызывает fetchMe и пропускает', async () => {
    localStorage.setItem('token', 'valid-token')
    mockFetchMe.mockResolvedValueOnce(undefined)
    setAuthStore({ user: null })

    const result = await authGuard(toWithMeta({ requiresAuth: true }))

    expect(mockFetchMe).toHaveBeenCalledOnce()
    expect(result).toBeUndefined()
  })

  it('fetchMe падает → clearAuth и redirect на /login', async () => {
    localStorage.setItem('token', 'invalid-token')
    mockFetchMe.mockRejectedValueOnce(new Error('401'))
    setAuthStore({ user: null })

    const result = await authGuard(toWithMeta({ requiresAuth: true }))

    expect(mockClearAuth).toHaveBeenCalledOnce()
    expect(result).toEqual({ path: '/login' })
  })
})

describe('routes структура', () => {
  it('маршрут / требует авторизации (requiresAuth)', () => {
    const mainRoute = routes.find((route) => route.path === '/')
    expect(mainRoute?.meta?.requiresAuth).toBe(true)
  })

  it('маршрут /login требует гостя (requiresGuest)', () => {
    const loginRoute = routes.find((route) => route.path === '/login')
    expect(loginRoute?.meta?.requiresGuest).toBe(true)
  })

  it('admin-маршруты помечены requiresAdmin', () => {
    const mainRoute = routes.find((route) => route.path === '/')
    const adminPaths = (mainRoute?.children ?? []).filter((child) => child.meta?.requiresAdmin).map((child) => child.path)
    expect(adminPaths).toContain('settings/llm')
    expect(adminPaths).toContain('admin/users')
  })

  it('catchAll маршрут существует для 404', () => {
    const notFoundRoute = routes.find((route) => route.path === '/:catchAll(.*)*')
    expect(notFoundRoute).toBeDefined()
  })
})
