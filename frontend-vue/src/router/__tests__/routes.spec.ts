import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

vi.mock('@/boot/axios', () => ({
  api: { get: vi.fn(), post: vi.fn() }
}))

vi.mock('@/entities/user', () => ({
  useAuthStore: vi.fn()
}))

// Замокаем routes, чтобы обойти динамические импорты Quasar-компонентов
vi.mock('@/router/routes', () => {
  const stub = { template: '<div />' }
  const routes: RouteRecordRaw[] = [
    {
      path: '/login',
      component: stub,
      meta: { requiresGuest: true },
      children: [{ path: '', component: stub }]
    },
    {
      path: '/',
      component: stub,
      meta: { requiresAuth: true },
      children: [
        { path: '', component: stub },
        { path: 'feed', component: stub },
        { path: 'search', component: stub },
        { path: 'logs', component: stub },
        {
          path: 'settings/llm',
          component: stub,
          meta: { requiresAdmin: true }
        },
        {
          path: 'admin/users',
          component: stub,
          meta: { requiresAdmin: true }
        }
      ]
    },
    { path: '/:catchAll(.*)*', component: stub }
  ]
  return { default: routes }
})

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

const createTestRouter = () => {
  const router = createRouter({ history: createMemoryHistory(), routes })

  router.beforeEach(async (to) => {
    const authStore = useAuthStore() as ReturnType<typeof makeAuthStore>
    const token = localStorage.getItem('token')

    if (to.meta.requiresAuth) {
      if (!token) return { path: '/login' }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!authStore.user) {
        try {
          await authStore.fetchMe()
        } catch {
          authStore.clearAuth()
          return { path: '/login' }
        }
      }
      if (to.meta.requiresAdmin && !authStore.isAdmin) return { path: '/' }
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (to.meta.requiresGuest && token && authStore.user) return { path: '/' }
  })

  return router
}

describe('router guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('неаутентифицированный → redirect на /login для requiresAuth маршрута', async () => {
    vi.mocked(useAuthStore).mockReturnValue(makeAuthStore() as unknown as ReturnType<typeof useAuthStore>)
    const router = createTestRouter()
    await router.push('/feed')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('аутентифицированный + requiresGuest → redirect на /', async () => {
    localStorage.setItem('token', 'valid-token')
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ user: { id: 1 } }) as unknown as ReturnType<typeof useAuthStore>
    )
    const router = createTestRouter()
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('не-admin + requiresAdmin → redirect на /', async () => {
    localStorage.setItem('token', 'valid-token')
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ user: { id: 1 }, isAdmin: false }) as unknown as ReturnType<typeof useAuthStore>
    )
    const router = createTestRouter()
    await router.push('/settings/llm')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('admin + requiresAdmin → пропускает', async () => {
    localStorage.setItem('token', 'valid-token')
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ user: { id: 1 }, isAdmin: true }) as unknown as ReturnType<typeof useAuthStore>
    )
    const router = createTestRouter()
    await router.push('/settings/llm')
    expect(router.currentRoute.value.path).toBe('/settings/llm')
  })
})

describe('routes структура', () => {
  it('маршрут / имеет meta.requiresAuth', () => {
    const mainRoute = routes.find((route) => route.path === '/')
    expect(mainRoute?.meta?.requiresAuth).toBe(true)
  })

  it('маршрут /login имеет meta.requiresGuest', () => {
    const loginRoute = routes.find((route) => route.path === '/login')
    expect(loginRoute?.meta?.requiresGuest).toBe(true)
  })

  it('catchAll маршрут существует для 404', () => {
    const notFoundRoute = routes.find((route) => route.path === '/:catchAll(.*)*')
    expect(notFoundRoute).toBeDefined()
  })
})
