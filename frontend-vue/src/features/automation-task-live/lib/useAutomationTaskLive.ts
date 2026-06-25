import { onBeforeUnmount } from 'vue'
import { echo } from '@/shared/lib'
import { useAutomationTaskStore } from '@/entities/automation-task'
import type { AutomationTaskProgressEvent } from '@/entities/automation-task'

// Realtime-подписка на прогресс задач автоматизации (калька useCommentGeneration).
// Подписывается на private-канал automation-task.{taskId} и применяет события
// .AutomationTaskProgress к стору. Echo не гарантирует доставку пропущенных
// событий — после reconnect синхронизация делается через taskStore.fetchTask.
export function useAutomationTaskLive() {
  const taskStore = useAutomationTaskStore()
  const subscribed = new Set<number>()

  const subscribe = (taskId: number) => {
    if (subscribed.has(taskId)) return
    subscribed.add(taskId)

    echo.private(`automation-task.${String(taskId)}`)
      .listen('.AutomationTaskProgress', (event: AutomationTaskProgressEvent) => {
        // Парс-прогресс приходит на тот же канал (current_action === 'parsing'): он несёт
        // фазу сбора целей, а не execution-счётчики. Роутим его в applyParseProgress —
        // карточка реактивно меняет фазу (parsing → done/failed) без рефетча. Детальный
        // flow review-шага (рефетч целей) держит отдельный useParseProgress.
        if (event.current_action === 'parsing') {
          taskStore.applyParseProgress(taskId, event)
          return
        }
        taskStore.applyProgress(taskId, event)
      })
  }

  const unsubscribe = (taskId: number) => {
    if (!subscribed.has(taskId)) return
    echo.leave(`automation-task.${String(taskId)}`)
    subscribed.delete(taskId)
  }

  const unsubscribeAll = () => {
    subscribed.forEach((taskId) => echo.leave(`automation-task.${String(taskId)}`))
    subscribed.clear()
  }

  onBeforeUnmount(unsubscribeAll)

  return { subscribe, unsubscribe, unsubscribeAll }
}
