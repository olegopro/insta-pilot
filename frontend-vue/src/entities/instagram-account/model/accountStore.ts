import { computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import type {
  InstagramAccount,
  InstagramAccountDetailed,
  AddAccountRequest,
  AddAccountResponse
} from '@/entities/instagram-account/model/types'

export const useAccountStore = defineStore('accounts', () => {
  const fetchAccounts = useApi<ApiResponseWrapper<InstagramAccount[]>>(
    () => api.get('/accounts/').then((response) => response.data)
  )

  const addAccount = useApi<ApiResponseWrapper<AddAccountResponse>, AddAccountRequest>(
    (args) => api.post('/accounts/login', args).then((response) => response.data)
  )

  const fetchAccountDetails = useApi<ApiResponseWrapper<InstagramAccountDetailed>, number>(
    (id) => api.get(`/accounts/${String(id)}`).then((response) => response.data)
  )

  const deleteAccount = useApi<ApiResponseWrapper<null>, number>(
    (id) => api.delete(`/accounts/${String(id)}`).then((response) => response.data)
  )

  const accounts = computed(() => fetchAccounts.response.value?.data ?? [])
  const accountDetail = computed(() => fetchAccountDetails.response.value?.data ?? null)

  return { fetchAccounts, addAccount, fetchAccountDetails, deleteAccount, accounts, accountDetail }
})
