import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import type { UserApi, LoginRequestApi, AuthResponseApi } from '@/entities/user/model/apiTypes'
import type { User, LoginRequest } from '@/entities/user/model/types'
import type { Nullable } from '@/shared/lib'
import userDTO from '@/entities/user/model/userDTO'

export const useAuthStore = defineStore('auth', () => {
  const user = shallowRef<Nullable<User>>(null)

  const loginApi = useApi<ApiResponseWrapper<AuthResponseApi>, LoginRequestApi>(
    (credentials) => api.post('/auth/login', credentials).then((response) => response.data)
  )

  const logoutApi = useApi<ApiResponseWrapper<null>>(
    () => api.post('/auth/logout').then((response) => response.data)
  )

  const meApi = useApi<ApiResponseWrapper<UserApi>>(
    () => api.get('/auth/me').then((response) => response.data)
  )

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.roles.some((role) => role.name === 'admin') ?? false)

  const login = async (payload: LoginRequest) => {
    const { data } = await loginApi.execute(payload)
    const auth = userDTO.toLocalAuth(data)
    user.value = auth.user
    localStorage.setItem('token', auth.token)
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
    user.value = userDTO.toLocal(data)
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
