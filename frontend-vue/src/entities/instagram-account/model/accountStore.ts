import { defineStore } from 'pinia'
import { api } from 'src/boot/axios'
import { useApi, type ApiResponseWrapper } from 'src/shared/api'
import type { InstagramAccount, LoginRequest, LoginResponse } from 'src/entities/instagram-account/model/types'

export const useAccountStore = defineStore('accounts', () => {
  const login = useApi<ApiResponseWrapper<LoginResponse>, LoginRequest>(
    (args) => api.post('/accounts/login', args).then((response) => response.data)
  )

  const fetchAccounts = useApi<ApiResponseWrapper<InstagramAccount[]>>(
    () => api.get('/accounts/').then((response) => response.data)
  )

  return { login, fetchAccounts }
})
