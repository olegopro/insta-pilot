import { defineStore } from 'pinia'
import { api } from 'src/boot/axios'
import { useApi } from 'src/composables/useApi'
import type { LoginRequest, LoginResponse } from 'src/models/AccountModel'
import type { ApiResponseWrapper } from 'src/models/ApiModel' 
import type { InstagramProfile } from 'src/types/instagram'   

export const useAccountStore = defineStore('accounts', () => {
  const login = useApi<ApiResponseWrapper<LoginResponse>, LoginRequest>(
    (args) => api.post('/accounts/login', args).then((response) => response.data)
  )

  const fetchAccounts = useApi<ApiResponseWrapper<InstagramProfile[]>>(
    () => api.get('/accounts/').then((response) => response.data)
  )

  return { login, fetchAccounts }
})
