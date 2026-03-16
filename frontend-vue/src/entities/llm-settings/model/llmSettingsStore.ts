import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import { api } from '@/boot/axios'
import type { LlmSetting, LlmSettingFormData, LlmProvider } from './types'
import type { LlmSettingApi } from './apiTypes'

const toLocal = (item: LlmSettingApi): LlmSetting => ({
  id: item.id,
  provider: item.provider as LlmProvider,
  modelName: item.model_name,
  systemPrompt: item.system_prompt,
  tone: item.tone as LlmSetting['tone'],
  isDefault: item.is_default,
  createdAt: item.created_at,
  updatedAt: item.updated_at
})

export const useLlmSettingsStore = defineStore('llmSettings', () => {
  const fetchAllApi = useApi<ApiResponseWrapper<LlmSettingApi[]>>(
    () => api.get('/llm-settings').then((response) => response.data)
  )

  const storeApi = useApi<ApiResponseWrapper<LlmSettingApi>, LlmSettingFormData>(
    (data) => api.post('/llm-settings', {
      provider: data.provider,
      api_key: data.apiKey,
      model_name: data.modelName,
      system_prompt: data.systemPrompt,
      tone: data.tone
    }).then((response) => response.data)
  )

  const setDefaultApi = useApi<ApiResponseWrapper<null>, { id: number }>(
    ({ id }) => api.patch(`/llm-settings/${String(id)}/default`).then((response) => response.data)
  )

  const deleteApi = useApi<ApiResponseWrapper<null>, { id: number }>(
    ({ id }) => api.delete(`/llm-settings/${String(id)}`).then((response) => response.data)
  )

  const testConnectionApi = useApi<ApiResponseWrapper<null>, { provider: string; apiKey: string; modelName: string }>(
    (data) => api.post('/llm-settings/test', {
      provider: data.provider,
      api_key: data.apiKey,
      model_name: data.modelName
    }).then((response) => response.data)
  )

  const settings = ref<LlmSetting[]>([])

  const fetchAll = async () => {
    const { data } = await fetchAllApi.execute()
    settings.value = data.map(toLocal)
  }
  const fetchAllLoading = computed(() => fetchAllApi.loading.value)

  const saveSetting = async (formData: LlmSettingFormData) => {
    await storeApi.execute(formData)
    await fetchAll()
  }
  const saveSettingLoading = computed(() => storeApi.loading.value)
  const saveSettingError = computed(() => storeApi.error.value)

  const setDefault = async (id: number) => {
    await setDefaultApi.execute({ id })
    await fetchAll()
  }
  const setDefaultLoading = computed(() => setDefaultApi.loading.value)

  const deleteSetting = async (id: number) => {
    await deleteApi.execute({ id })
    await fetchAll()
  }

  const testConnection = (provider: string, apiKey: string, modelName: string) =>
    testConnectionApi.execute({ provider, apiKey, modelName })
  const testConnectionLoading = computed(() => testConnectionApi.loading.value)
  const testConnectionError = computed(() => testConnectionApi.error.value)

  return {
    settings,
    fetchAll,
    fetchAllLoading,
    saveSetting,
    saveSettingLoading,
    saveSettingError,
    setDefault,
    setDefaultLoading,
    deleteSetting,
    testConnection,
    testConnectionLoading,
    testConnectionError
  }
})
