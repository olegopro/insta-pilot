import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { apiData, useApi, type ApiResponseWrapper } from '@/shared/api'
import type {
  AccountSettingsApi,
  UpdateLimitsRequestApi,
  UpdateWorkingHoursRequestApi
} from '@/entities/automation-settings/model/apiTypes'
import type { ActionLimit, WorkingHours } from '@/entities/automation-settings/model/types'
import { createDefaultLimits, createDefaultWorkingHours } from '@/entities/automation-settings/model/constants'
import automationSettingsDTO from '@/entities/automation-settings/model/automationSettingsDTO'

// NB: точные пути настроек лимитов/рабочих часов согласуются с бэкендом.
// Базовый контракт задания фиксирует только /automation/*; настройки привязаны
// к аккаунту, поэтому используются вложенные пути /accounts/{id}/automation-settings.
export const useAutomationSettingsStore = defineStore('automationSettings', () => {
  const fetchSettingsApi = useApi<ApiResponseWrapper<AccountSettingsApi>, number>(
    (accountId) => apiData(api.get(`/accounts/${String(accountId)}/automation-settings`))
  )

  const updateLimitsApi = useApi<ApiResponseWrapper<null>, { accountId: number; payload: UpdateLimitsRequestApi }>(
    ({ accountId, payload }) =>
      apiData(api.put(`/accounts/${String(accountId)}/automation-settings/limits`, payload))
  )

  const updateWorkingHoursApi = useApi<ApiResponseWrapper<null>, { accountId: number; payload: UpdateWorkingHoursRequestApi }>(
    ({ accountId, payload }) =>
      apiData(api.put(`/accounts/${String(accountId)}/automation-settings/working-hours`, payload))
  )

  const limits = ref<ActionLimit[]>(createDefaultLimits())
  const workingHours = ref<WorkingHours>(createDefaultWorkingHours())

  const fetchSettings = async (accountId: number) => {
    const { data } = await fetchSettingsApi.execute(accountId)
    const local = automationSettingsDTO.toLocal(data)
    limits.value = local.limits
    workingHours.value = local.workingHours
  }
  const fetchSettingsLoading = computed(() => fetchSettingsApi.loading.value)

  const saveLimits = async (accountId: number) => await updateLimitsApi.execute({
    accountId,
    payload: automationSettingsDTO.limitsToApi(limits.value)
  })
  const saveLimitsLoading = computed(() => updateLimitsApi.loading.value)

  const saveWorkingHours = async (accountId: number) => await updateWorkingHoursApi.execute({
    accountId,
    payload: automationSettingsDTO.workingHoursToApi(workingHours.value)
  })
  const saveWorkingHoursLoading = computed(() => updateWorkingHoursApi.loading.value)

  const resetSettings = () => {
    limits.value = createDefaultLimits()
    workingHours.value = createDefaultWorkingHours()
  }

  return {
    limits,
    workingHours,
    fetchSettings,
    fetchSettingsLoading,
    saveLimits,
    saveLimitsLoading,
    saveWorkingHours,
    saveWorkingHoursLoading,
    resetSettings
  }
})
