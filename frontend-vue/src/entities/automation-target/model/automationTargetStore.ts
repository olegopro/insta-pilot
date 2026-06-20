import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { apiData, useApi, type ApiResponseWrapper } from '@/shared/api'
import type { AutomationTargetsResponseApi } from '@/entities/automation-target/model/apiTypes'
import type { AutomationTarget } from '@/entities/automation-target/model/types'
import automationTargetDTO from '@/entities/automation-target/model/automationTargetDTO'

export const useAutomationTargetStore = defineStore('automationTargets', () => {
  const fetchTargetsApi = useApi<ApiResponseWrapper<AutomationTargetsResponseApi>, number>(
    (taskId) => apiData(api.get(`/automation/${String(taskId)}/targets`))
  )

  const excludeTargetApi = useApi<ApiResponseWrapper<null>, { taskId: number; targetId: number }>(
    ({ taskId, targetId }) =>
      apiData(api.patch(`/automation/${String(taskId)}/targets/${String(targetId)}/exclude`))
  )

  const restoreTargetApi = useApi<ApiResponseWrapper<null>, { taskId: number; targetId: number }>(
    ({ taskId, targetId }) =>
      apiData(api.patch(`/automation/${String(taskId)}/targets/${String(targetId)}/restore`))
  )

  const targets = ref<AutomationTarget[]>([])

  const keptTargets = computed(() => targets.value.filter((target) => target.status === 'kept'))
  const trashedTargets = computed(() => targets.value.filter((target) => target.status === 'trashed'))

  const fetchTargets = async (taskId: number) => {
    const { data } = await fetchTargetsApi.execute(taskId)
    targets.value = automationTargetDTO.toLocalList(data)
  }
  const fetchTargetsLoading = computed(() => fetchTargetsApi.loading.value)

  const setTargetStatus = (targetId: number, status: AutomationTarget['status']) => {
    const target = targets.value.find((item) => item.id === targetId)
    target && (target.status = status)
  }

  const excludeTarget = async (taskId: number, targetId: number) => {
    setTargetStatus(targetId, 'trashed')
    await excludeTargetApi.execute({ taskId, targetId })
  }

  const restoreTarget = async (taskId: number, targetId: number) => {
    setTargetStatus(targetId, 'kept')
    await restoreTargetApi.execute({ taskId, targetId })
  }

  const clearTargets = () => targets.value = []

  return {
    targets,
    keptTargets,
    trashedTargets,
    fetchTargets,
    fetchTargetsLoading,
    excludeTarget,
    restoreTarget,
    clearTargets
  }
})
