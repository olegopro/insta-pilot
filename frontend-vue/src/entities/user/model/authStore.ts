import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import type { User, LoginRequest, AuthResponse } from '@/entities/user/model/types'
import type { Nullable } from '@/shared/lib'

export const useAuthStore = defineStore('auth', () => {
  const user = shallowRef<Nullable<User>>(null)

  const loginApi = useApi<ApiResponseWrapper<AuthResponse>, LoginRequest>(
    (args) => api.post('/auth/login', args).then((response) => response.data)
  )

  const logoutApi = useApi<ApiResponseWrapper<null>>(
    () => api.post('/auth/logout').then((response) => response.data)
  )

  const meApi = useApi<ApiResponseWrapper<User>>(
    () => api.get('/auth/me').then((response) => response.data)
  )

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.roles.some((role) => role.name === 'admin') ?? false)

  const login = async (payload: LoginRequest) => {
    const { data } = await loginApi.execute(payload)
    user.value = data.user
    localStorage.setItem('token', data.token)
  }
  const loginLoading = computed(() => loginApi.loading.value)
  const loginError = computed(() => loginApi.error.value)

  const logout = async () => {
    await logoutApi.execute()
    user.value = null
    localStorage.removeItem('token')
  }

  const fetchMe = async () => {
    const { data } = await meApi.execute()
    user.value = data
  }

  const clearAuth = () => {
    user.value = null
    localStorage.removeItem('token')
  }

  return {
    user,
    isAuthenticated,
    isAdmin,
    login,
    loginLoading,
    loginError,
    logout,
    fetchMe,
    clearAuth
  }
})
