import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { apiData, useApi, type ApiResponseWrapper } from '@/shared/api'
import type {
  AutomationTaskApi,
  AutomationTasksResponseApi,
  CreateAutomationTaskRequestApi,
  StartAutomationTaskRequestApi
} from '@/entities/automation-task/model/apiTypes'
import type {
  AutomationTask,
  AutomationTaskStatus,
  AutomationParseStatus,
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

  const startTaskApi = useApi<ApiResponseWrapper<null>, { taskId: number; payload?: StartAutomationTaskRequestApi }>(
    ({ taskId, payload }) => apiData(api.post(`/automation/${String(taskId)}/start`, payload))
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

  const deleteTaskApi = useApi<ApiResponseWrapper<null>, number>(
    (taskId) => apiData(api.delete(`/automation/${String(taskId)}`))
  )

  const cloneTaskApi = useApi<ApiResponseWrapper<AutomationTaskApi>, number>(
    (taskId) => apiData(api.post(`/automation/${String(taskId)}/clone`))
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
  const startTask = (taskId: number, payload?: StartAutomationTaskRequestApi) =>
    startTaskApi.execute(payload ? { taskId, payload } : { taskId })
  const startTaskLoading = computed(() => startTaskApi.loading.value)

  const pauseTask = (taskId: number) => pauseTaskApi.execute(taskId)
  const resumeTask = (taskId: number) => resumeTaskApi.execute(taskId)
  const cancelTask = (taskId: number) => cancelTaskApi.execute(taskId)

  // Удаление задачи: после успеха убираем из списка и чистим currentTask, если это была она.
  const deleteTask = async (taskId: number) => {
    await deleteTaskApi.execute(taskId)
    tasks.value = tasks.value.filter((item) => item.id !== taskId)
    if (currentTask.value?.id === taskId) clearCurrentTask()
  }
  const deleteTaskLoading = computed(() => deleteTaskApi.loading.value)

  // Клонирование терминальной задачи: бэк возвращает новый черновик, добавляем его в список.
  const cloneTask = async (taskId: number) => {
    const { data } = await cloneTaskApi.execute(taskId)
    const task = automationTaskDTO.toLocal(data)
    upsertTask(task)
    return task
  }
  const cloneTaskLoading = computed(() => cloneTaskApi.loading.value)

  // Перезапуск парсинга черновика после parseStatus='failed': дёргаем тот же endpoint,
  // что и при создании, и оптимистично переводим задачу в фазу 'parsing' (финальный статус
  // приедет через applyParseProgress по WebSocket).
  const retryParse = async (taskId: number) => {
    await parseTargetsApi.execute(taskId)
    const patch = (task: AutomationTask) => {
      task.parseStatus = 'parsing'
      task.parseError = null
    }
    const task = tasks.value.find((item) => item.id === taskId)
    task && patch(task)
    if (currentTask.value?.id === taskId) patch(currentTask.value)
  }
  const retryParseLoading = computed(() => parseTargetsApi.loading.value)

  const upsertTask = (task: AutomationTask) => {
    const index = tasks.value.findIndex((item) => item.id === task.id)
    if (index === -1) {
      tasks.value = [task, ...tasks.value]
    } else {
      tasks.value[index] = task
    }
  }

  // Применяет полезную нагрузку realtime-события .AutomationTaskProgress к задаче в списке.
  // Только execution-события (current_action !== 'parsing'): status здесь — реальный
  // AutomationTaskStatus, фазового 'parsing' не бывает (его роутит applyParseProgress).
  const applyProgress = (taskId: number, event: AutomationTaskProgressEvent) => {
    const status = event.status as AutomationTaskStatus
    const task = tasks.value.find((item) => item.id === taskId)
    if (task) {
      task.status = status
      task.itemsTotal = event.items_total
      task.itemsDone = event.items_done
      task.itemsFailed = event.items_failed
      task.itemsSkipped = event.items_skipped
      task.currentAction = event.current_action
    }
    if (currentTask.value?.id === taskId) {
      currentTask.value.status = status
      currentTask.value.itemsTotal = event.items_total
      currentTask.value.itemsDone = event.items_done
      currentTask.value.itemsFailed = event.items_failed
      currentTask.value.itemsSkipped = event.items_skipped
      currentTask.value.currentAction = event.current_action
    }
  }

  // Применяет прогресс ФАЗЫ ПАРСИНГА (событие с current_action='parsing') к задаче:
  // обновляет parseStatus/parseError/collectedTargetsCount, не трогая execution-счётчики.
  // Это даёт реактивную смену фазы карточки (parsing → done/failed) без рефетча.
  const applyParseProgress = (taskId: number, event: AutomationTaskProgressEvent) => {
    const parseStatus: AutomationParseStatus =
      event.status === 'failed'
        ? 'failed'
        : event.status === 'completed'
          ? 'done'
          : 'parsing'
    const patch = (task: AutomationTask) => {
      task.parseStatus = parseStatus
      task.parseError = parseStatus === 'failed' ? (event.error_message ?? null) : null
      if (parseStatus === 'done') task.collectedTargetsCount = event.collected ?? event.items_total
    }
    const task = tasks.value.find((item) => item.id === taskId)
    task && patch(task)
    if (currentTask.value?.id === taskId) patch(currentTask.value)
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
    deleteTask,
    deleteTaskLoading,
    cloneTask,
    cloneTaskLoading,
    retryParse,
    retryParseLoading,
    applyProgress,
    applyParseProgress,
    clearCurrentTask
  }
})
