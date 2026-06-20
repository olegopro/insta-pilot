import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { apiData, useApi, type ApiResponseWrapper } from '@/shared/api'
import type { Nullable } from '@/shared/lib'
import type {
  InstagramAccountApi,
  InstagramAccountDetailedApi,
  AddAccountResponseApi,
  DeviceProfileApi
} from '@/entities/instagram-account/model/apiTypes'
import type { InstagramAccount, InstagramAccountDetailed, AddAccountRequest, DeviceProfile } from '@/entities/instagram-account/model/types'
import instagramAccountDTO from '@/entities/instagram-account/model/instagramAccountDTO'

export const useAccountStore = defineStore('accounts', () => {
  const fetchAccountsApi = useApi<ApiResponseWrapper<InstagramAccountApi[]>>(
    () => apiData(api.get('/accounts/'))
  )

  const addAccountApi = useApi<ApiResponseWrapper<AddAccountResponseApi>, AddAccountRequest>(
    (payload) => apiData(api.post('/accounts/login', instagramAccountDTO.toApiRequest(payload)))
  )

  const fetchAccountDetailsApi = useApi<ApiResponseWrapper<InstagramAccountDetailedApi>, number>(
    (accountId) => apiData(api.get(`/accounts/${String(accountId)}`))
  )

  const fetchDeviceProfilesApi = useApi<ApiResponseWrapper<DeviceProfileApi[]>>(
    () => apiData(api.get('/accounts/device-profiles'))
  )

  const deleteAccountApi = useApi<ApiResponseWrapper<null>, number>(
    (accountId) => apiData(api.delete(`/accounts/${String(accountId)}`))
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
