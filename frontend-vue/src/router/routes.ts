import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: { requiresGuest: true },
    children: [
      {
        path: '',
        component: () => import('@/pages/login/ui/LoginPage.vue')
      }
    ]
  },
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        component: () => import('@/pages/instagram-accounts/ui/InstagramAccountsPage.vue')
      },
      {
        path: 'feed',
        component: () => import('@/pages/feed/ui/FeedPage.vue')
      },
      {
        path: 'search',
        component: () => import('@/pages/search/ui/SearchPage.vue')
      },
      {
        path: 'logs',
        component: () => import('@/pages/logs/ui/LogsPage.vue')
      },
      {
        path: 'logs/:accountId',
        component: () => import('@/pages/logs/ui/LogsPage.vue')
      },
      {
        path: 'settings/llm',
        component: () => import('@/pages/llm-settings/ui/LlmSettingsPage.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'admin/users',
        component: () => import('@/pages/admin-users/ui/AdminUsersPage.vue'),
        meta: { requiresAdmin: true }
      }
    ]
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
