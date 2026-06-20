import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { apiData, useApi, type ApiResponseWrapper } from '@/shared/api'
import type {
  AutomationTaskApi,
  AutomationTasksResponseApi,
  CreateAutomationTaskRequestApi
} from '@/entities/automation-task/model/apiTypes'
import type {
  AutomationTask,
  AutomationTaskProgressEvent
} from '@/entities/automation-task/model/types'
import automationTaskDTO from '@/entities/automation-task/model/automationTaskDTO'

export const useAutomationTaskStore = defineStore('automationTasks', () => {
  const fetchTasksApi = useApi<ApiResponseWrapper<AutomationTasksResponseApi>>(
    () => apiData(api.get('/automation'))
  )

  const fetchTaskApi = useApi<ApiResponseWrapper<AutomationTaskApi>, number>(
    (taskId) => apiData(api.get(`/automation/${String(taskId)}`))
  )

  const createTaskApi = useApi<ApiResponseWrapper<AutomationTaskApi>, CreateAutomationTaskRequestApi>(
    (payload) => apiData(api.post('/automation', payload))
  )

  const parseTargetsApi = useApi<ApiResponseWrapper<null>, number>(
    (taskId) => apiData(api.post(`/automation/${String(taskId)}/parse-targets`))
  )

  const startTaskApi = useApi<ApiResponseWrapper<null>, number>(
    (taskId) => apiData(api.post(`/automation/${String(taskId)}/start`))
  )

  const pauseTaskApi = useApi<ApiResponseWrapper<null>, number>(
    (taskId) => apiData(api.post(`/automation/${String(taskId)}/pause`))
  )

  const resumeTaskApi = useApi<ApiResponseWrapper<null>, number>(
    (taskId) => apiData(api.post(`/automation/${String(taskId)}/resume`))
  )

  const cancelTaskApi = useApi<ApiResponseWrapper<null>, number>(
    (taskId) => apiData(api.post(`/automation/${String(taskId)}/cancel`))
  )

  const tasks = ref<AutomationTask[]>([])
  const currentTask = ref<AutomationTask | null>(null)

  const fetchTasks = async () => {
    const { data } = await fetchTasksApi.execute()
    tasks.value = automationTaskDTO.toLocalList(data)
  }
  const fetchTasksLoading = computed(() => fetchTasksApi.loading.value)

  const fetchTask = async (taskId: number) => {
    const { data } = await fetchTaskApi.execute(taskId)
    currentTask.value = automationTaskDTO.toLocal(data)
    upsertTask(currentTask.value)
    return currentTask.value
  }
  const fetchTaskLoading = computed(() => fetchTaskApi.loading.value)

  // Создаёт задачу (черновик) и сразу запускает парсинг источника на бэке.
  const createTask = async (payload: CreateAutomationTaskRequestApi) => {
    const { data } = await createTaskApi.execute(payload)
    const task = automationTaskDTO.toLocal(data)
    currentTask.value = task
    upsertTask(task)
    return task
  }
  const createTaskLoading = computed(() => createTaskApi.loading.value)
  const createTaskError = computed(() => createTaskApi.error.value)

  const parseTargets = (taskId: number) => parseTargetsApi.execute(taskId)

  // Запуск/пауза/продолжение/отмена — fire-and-forget, итоговый статус приходит
  // через realtime applyProgress либо fetchTask после reconnect.
  const startTask = (taskId: number) => startTaskApi.execute(taskId)
  const startTaskLoading = computed(() => startTaskApi.loading.value)

  const pauseTask = (taskId: number) => pauseTaskApi.execute(taskId)
  const resumeTask = (taskId: number) => resumeTaskApi.execute(taskId)
  const cancelTask = (taskId: number) => cancelTaskApi.execute(taskId)

  const upsertTask = (task: AutomationTask) => {
    const index = tasks.value.findIndex((item) => item.id === task.id)
    if (index === -1) {
      tasks.value = [task, ...tasks.value]
    } else {
      tasks.value[index] = task
    }
  }

  // Применяет полезную нагрузку realtime-события .AutomationTaskProgress к задаче в списке.
  const applyProgress = (taskId: number, event: AutomationTaskProgressEvent) => {
    const task = tasks.value.find((item) => item.id === taskId)
    if (task) {
      task.status = event.status
      task.itemsTotal = event.items_total
      task.itemsDone = event.items_done
      task.itemsFailed = event.items_failed
      task.itemsSkipped = event.items_skipped
      task.currentAction = event.current_action
    }
    if (currentTask.value?.id === taskId) {
      currentTask.value.status = event.status
      currentTask.value.itemsTotal = event.items_total
      currentTask.value.itemsDone = event.items_done
      currentTask.value.itemsFailed = event.items_failed
      currentTask.value.itemsSkipped = event.items_skipped
      currentTask.value.currentAction = event.current_action
    }
  }

  const clearCurrentTask = () => currentTask.value = null

  return {
    tasks,
    currentTask,
    fetchTasks,
    fetchTasksLoading,
    fetchTask,
    fetchTaskLoading,
    createTask,
    createTaskLoading,
    createTaskError,
    parseTargets,
    startTask,
    startTaskLoading,
    pauseTask,
    resumeTask,
    cancelTask,
    applyProgress,
    clearCurrentTask
  }
})
