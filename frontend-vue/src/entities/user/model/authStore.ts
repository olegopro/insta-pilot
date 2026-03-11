import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import type { User, LoginRequest, AuthResponse } from '@/entities/user/model/types'
import type { Nullable } from '@/shared/lib'

export const useAuthStore = defineStore('auth', () => {
  const user = shallowRef<Nullable<User>>(null)

  const loginApi = useApi<ApiResponseWrapper<AuthResponse>, LoginRequest>(
    (args) => api.post('/auth/login', args).then((r) => r.data)
  )

  const logoutApi = useApi<ApiResponseWrapper<null>>(
    () => api.post('/auth/logout').then((r) => r.data)
  )

  const meApi = useApi<ApiResponseWrapper<User>>(
    () => api.get('/auth/me').then((r) => r.data)
  )

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.roles.some((r) => r.name === 'admin') ?? false)

  const login = async (payload: LoginRequest) => {
    await loginApi.execute(payload)
    const result = loginApi.data.value?.data
    if (result) {
      user.value = result.user
      localStorage.setItem('token', result.token)
    }
  }

  const logout = async () => {
    await logoutApi.execute()
    user.value = null
    localStorage.removeItem('token')
  }

  const fetchMe = async () => {
    await meApi.execute()
    user.value = meApi.data.value?.data ?? null
  }

  const clearAuth = () => {
    user.value = null
    localStorage.removeItem('token')
  }

  return { user, isAuthenticated, isAdmin, loginApi, logoutApi, meApi, login, logout, fetchMe, clearAuth }
})
