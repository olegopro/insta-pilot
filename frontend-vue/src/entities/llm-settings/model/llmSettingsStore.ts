import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import { api } from '@/boot/axios'
import type { LlmSetting, LlmSettingFormData } from './types'
import type { LlmSettingApi, LlmSettingDetailApi } from './apiTypes'
import llmSettingsDTO from './llmSettingsDTO'

export const useLlmSettingsStore = defineStore('llmSettings', () => {
  const fetchAllApi = useApi<ApiResponseWrapper<LlmSettingApi[]>>(
    () => api.get('/llm-settings').then((response) => response.data)
  )

  const fetchOneApi = useApi<ApiResponseWrapper<LlmSettingDetailApi>, { id: number }>(
    ({ id }) => api.get(`/llm-settings/${String(id)}`).then((response) => response.data)
  )

  const storeApi = useApi<ApiResponseWrapper<LlmSettingApi>, LlmSettingFormData>(
    (data) => api.post('/llm-settings', {
      provider: data.provider,
      api_key: data.apiKey,
      model_name: data.modelName,
      system_prompt: data.systemPrompt,
      tone: data.tone,
      use_caption: data.useCaption
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
    settings.value = llmSettingsDTO.toLocalList(data)
  }
  const fetchAllLoading = computed(() => fetchAllApi.loading.value)

  const fetchOne = (id: number) => fetchOneApi.execute({ id })
  const fetchOneLoading = computed(() => fetchOneApi.loading.value)

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
  const deleteSettingLoading = computed(() => deleteApi.loading.value)
  const deleteSettingError = computed(() => deleteApi.error.value)

  const testConnection = (provider: string, apiKey: string, modelName: string) =>
    testConnectionApi.execute({ provider, apiKey, modelName })
  const testConnectionLoading = computed(() => testConnectionApi.loading.value)
  const testConnectionError = computed(() => testConnectionApi.error.value)

  return {
    settings,
    fetchAll,
    fetchAllLoading,
    fetchOne,
    fetchOneLoading,
    saveSetting,
    saveSettingLoading,
    saveSettingError,
    setDefault,
    setDefaultLoading,
    deleteSetting,
    deleteSettingLoading,
    deleteSettingError,
    testConnection,
    testConnectionLoading,
    testConnectionError
  }
})
