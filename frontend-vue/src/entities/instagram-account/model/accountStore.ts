import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import type { Nullable } from '@/shared/lib'
import type {
  InstagramAccountApi,
  InstagramAccountDetailedApi,
  AddAccountResponseApi,
  DeviceProfileApi
} from './apiTypes'
import type { InstagramAccount, InstagramAccountDetailed, AddAccountRequest, DeviceProfile } from './types'
import instagramAccountDTO from './instagramAccountDTO'

export const useAccountStore = defineStore('accounts', () => {
  const fetchAccountsApi = useApi<ApiResponseWrapper<InstagramAccountApi[]>>(
    () => api.get('/accounts/').then((response) => response.data)
  )

  const addAccountApi = useApi<ApiResponseWrapper<AddAccountResponseApi>, AddAccountRequest>(
    (payload) => api.post('/accounts/login', instagramAccountDTO.toApiRequest(payload)).then((response) => response.data)
  )

  const fetchAccountDetailsApi = useApi<ApiResponseWrapper<InstagramAccountDetailedApi>, number>(
    (accountId) => api.get(`/accounts/${String(accountId)}`).then((response) => response.data)
  )

  const fetchDeviceProfilesApi = useApi<ApiResponseWrapper<DeviceProfileApi[]>>(
    () => api.get('/accounts/device-profiles').then((response) => response.data)
  )

  const deleteAccountApi = useApi<ApiResponseWrapper<null>, number>(
    (accountId) => api.delete(`/accounts/${String(accountId)}`).then((response) => response.data)
  )

  const accounts = ref<InstagramAccount[]>([])
  const accountDetail = ref<Nullable<InstagramAccountDetailed>>(null)
  const deviceProfiles = ref<DeviceProfile[]>([])

  const fetchAccounts = async () => {
    const { data } = await fetchAccountsApi.execute()
    accounts.value = instagramAccountDTO.toLocalList(data)
  }
  const fetchAccountsLoading = computed(() => fetchAccountsApi.loading.value)

  const addAccount = (args: AddAccountRequest) => addAccountApi.execute(args)
  const addAccountLoading = computed(() => addAccountApi.loading.value)
  const addAccountError = computed(() => addAccountApi.error.value)

  const fetchAccountDetails = async (id: number) => {
    const { data } = await fetchAccountDetailsApi.execute(id)
    accountDetail.value = instagramAccountDTO.toLocalDetailed(data)
  }
  const fetchAccountDetailsLoading = computed(() => fetchAccountDetailsApi.loading.value)

  const fetchDeviceProfiles = async () => {
    const { data } = await fetchDeviceProfilesApi.execute()
    deviceProfiles.value = instagramAccountDTO.toLocalDeviceProfiles(data)
  }
  const fetchDeviceProfilesLoading = computed(() => fetchDeviceProfilesApi.loading.value)

  const deleteAccount = (id: number) => deleteAccountApi.execute(id)
  const deleteAccountLoading = computed(() => deleteAccountApi.loading.value)
  const deleteAccountError = computed(() => deleteAccountApi.error.value)

  return {
    accounts,
    accountDetail,
    deviceProfiles,
    fetchAccounts,
    fetchAccountsLoading,
    addAccount,
    addAccountLoading,
    addAccountError,
    fetchAccountDetails,
    fetchAccountDetailsLoading,
    fetchDeviceProfiles,
    fetchDeviceProfilesLoading,
    deleteAccount,
    deleteAccountLoading,
    deleteAccountError
  }
})
