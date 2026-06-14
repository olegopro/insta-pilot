import type { RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/entities/user'

/**
 * Навигационный guard роутера. Вынесен из router/index.ts отдельной чистой
 * функцией, чтобы покрывать реальную логику доступа unit-тестами
 * (а не её копию). Регистрируется в index.ts через Router.beforeEach(authGuard).
 */
export const authGuard = async (to: RouteLocationNormalized) => {
  const authStore = useAuthStore()
  const token = localStorage.getItem('token')

  if (to.meta.requiresAuth) {
    if (!token) return { path: '/login' }

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

  if (to.meta.requiresGuest && token && authStore.user) return { path: '/' }
}
