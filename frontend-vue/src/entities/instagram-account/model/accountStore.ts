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
  const fetchAccountsApi = useApi<ApiResponseWrapper<InstagramAccount[]>>(
    () => api.get('/accounts/').then((response) => response.data)
  )

  const addAccountApi = useApi<ApiResponseWrapper<AddAccountResponse>, AddAccountRequest>(
    (args) => api.post('/accounts/login', args).then((response) => response.data)
  )

  const fetchAccountDetailsApi = useApi<ApiResponseWrapper<InstagramAccountDetailed>, number>(
    (id) => api.get(`/accounts/${String(id)}`).then((response) => response.data)
  )

  const deleteAccountApi = useApi<ApiResponseWrapper<null>, number>(
    (id) => api.delete(`/accounts/${String(id)}`).then((response) => response.data)
  )

  const accounts = computed(() => fetchAccountsApi.response.value?.data ?? [])
  const accountDetail = computed(() => fetchAccountDetailsApi.response.value?.data ?? null)

  const fetchAccounts = () => fetchAccountsApi.execute()
  const fetchAccountsLoading = computed(() => fetchAccountsApi.loading.value)

  const addAccount = (args: AddAccountRequest) => addAccountApi.execute(args)
  const addAccountLoading = computed(() => addAccountApi.loading.value)
  const addAccountError = computed(() => addAccountApi.error.value)

  const fetchAccountDetails = (id: number) => fetchAccountDetailsApi.execute(id)
  const fetchAccountDetailsLoading = computed(() => fetchAccountDetailsApi.loading.value)

  const deleteAccount = (id: number) => deleteAccountApi.execute(id)
  const deleteAccountLoading = computed(() => deleteAccountApi.loading.value)
  const deleteAccountError = computed(() => deleteAccountApi.error.value)

  return {
    accounts,
    accountDetail,
    fetchAccounts,
    fetchAccountsLoading,
    addAccount,
    addAccountLoading,
    addAccountError,
    fetchAccountDetails,
    fetchAccountDetailsLoading,
    deleteAccount,
    deleteAccountLoading,
    deleteAccountError
  }
})
