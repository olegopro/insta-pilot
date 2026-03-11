import { defineRouter } from '#q-app/wrappers'
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory
} from 'vue-router'
import routes from '@/router/routes'
import { useAuthStore } from '@/entities/user'

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE)
  })

  Router.beforeEach(async (to) => {
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
  })

  return Router
})
