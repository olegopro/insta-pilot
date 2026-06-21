import { onBeforeUnmount } from 'vue'
import { echo } from '@/shared/lib'
import type { AutomationTaskProgressEvent } from '@/entities/automation-task'

// Прогресс парсинга приходит на тот же канал automation-task.{taskId} событием
// .AutomationTaskProgress с current_action='parsing'. Завершение парсинга — это
// терминальный статус ('completed' успех / 'failed' ошибка) при current_action='parsing'.
const PARSE_ACTION = 'parsing'
const DONE_STATUSES = ['completed']
const FAIL_STATUSES = ['failed']

// Fallback-поллинг на случай пропущенного Echo-события (доставка не гарантирована):
// несколько рефетчей целей с интервалом, пока не пришло терминальное событие.
const FALLBACK_ATTEMPTS = 8
const FALLBACK_INTERVAL_MS = 2500

interface ParseProgressOptions {
  // Рефетч целей задачи (источник истины после завершения парсинга).
  onDone: (taskId: number) => void | Promise<void>
  // Колбэк ошибки парсинга (status='failed' с current_action='parsing').
  onFail?: (taskId: number) => void
}

// Подписка на завершение async-парсинга задачи. После dispatch ParseTargetsJob бэк
// шлёт прогресс по WebSocket; при завершении вызываем onDone (рефетч целей). Параллельно
// крутим fallback-поллинг тем же onDone — если событие не дошло, цели всё равно подтянутся.
export function useParseProgress(options: ParseProgressOptions) {
  let channelTaskId: number | null = null
  let pollHandle: ReturnType<typeof setInterval> | null = null
  let settled = false

  const stopPolling = () => {
    pollHandle && clearInterval(pollHandle)
    pollHandle = null
  }

  const leave = () => {
    stopPolling()
    if (channelTaskId !== null) {
      echo.leave(`automation-task.${String(channelTaskId)}`)
      channelTaskId = null
    }
  }

  // Терминальное завершение по событию: гасит поллинг, отписывается, рефетчит цели.
  const finishDone = (taskId: number) => {
    if (settled) return
    settled = true
    leave()
    void options.onDone(taskId)
  }

  const finishFail = (taskId: number) => {
    if (settled) return
    settled = true
    leave()
    options.onFail?.(taskId)
  }

  // Слушает прогресс задачи и резолвит на терминальном событии парсинга. Параллельно
  // запускает fallback-поллинг (несколько рефетчей) на случай пропущенного события.
  const watchParse = (taskId: number) => {
    leave()
    settled = false
    channelTaskId = taskId

    echo.private(`automation-task.${String(taskId)}`)
      .listen('.AutomationTaskProgress', (event: AutomationTaskProgressEvent) => {
        if (event.current_action !== PARSE_ACTION) return
        if (DONE_STATUSES.includes(event.status)) finishDone(taskId)
        if (FAIL_STATUSES.includes(event.status)) finishFail(taskId)
      })

    let attempts = 0
    pollHandle = setInterval(() => {
      if (settled) {
        stopPolling()
        return
      }
      attempts++
      if (attempts >= FALLBACK_ATTEMPTS) {
        // Событие так и не дошло — финальная страховка: рефетчим цели и завершаем.
        finishDone(taskId)
        return
      }
      void options.onDone(taskId)
    }, FALLBACK_INTERVAL_MS)
  }

  onBeforeUnmount(leave)

  return { watchParse, leave }
}
