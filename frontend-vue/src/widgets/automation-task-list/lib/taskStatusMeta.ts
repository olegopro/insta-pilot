import { getActionTypeLabel } from '@/entities/automation-action'
import type { AutomationTask, AutomationTaskStatus } from '@/entities/automation-task'
import type { Nullable } from '@/shared/lib'

interface StatusMeta {
  label: string
  color: string
}

export const TASK_STATUS_META: Record<AutomationTaskStatus, StatusMeta> = {
  draft: { label: 'Черновик', color: 'grey' },
  scheduling: { label: 'Планирование', color: 'info' },
  running: { label: 'Выполняется', color: 'primary' },
  paused: { label: 'Пауза', color: 'warning' },
  completed: { label: 'Завершена', color: 'positive' },
  failed: { label: 'Ошибка', color: 'negative' },
  cancelled: { label: 'Отменена', color: 'grey' }
}

export const isActiveStatus = (status: AutomationTaskStatus): boolean =>
  status === 'running' || status === 'scheduling'

export const isPausedStatus = (status: AutomationTaskStatus): boolean => status === 'paused'

// Отменяемые статусы: задача уже запущена/планируется/на паузе. У draft и терминальных
// статусов кнопки управления (включая отмену) не показываем.
export const canCancelStatus = (status: AutomationTaskStatus): boolean =>
  status === 'running' || status === 'scheduling' || status === 'paused'

export const isTerminalStatus = (status: AutomationTaskStatus): boolean =>
  status === 'completed' || status === 'failed' || status === 'cancelled'

// Текущее действие для карточки: только на активных статусах и через локализованный лейбл;
// 'parsing'/неизвестное/терминальное/draft → null (сырое значение не показываем).
export const currentActionLabel = (task: Pick<AutomationTask, 'status' | 'currentAction'>): Nullable<string> =>
  isActiveStatus(task.status) ? getActionTypeLabel(task.currentAction) : null

// Текст терминальной задачи без action-items (itemsTotal===0) вместо «0/0».
export const emptyTerminalText = (task: Pick<AutomationTask, 'itemsSkipped'>): string =>
  task.itemsSkipped > 0 ? 'Все цели уже обработаны ранее' : 'Новых целей не найдено'

// Что показывать в stats-блоке карточки:
// - 'collected' — черновик: число собранных целей (execution-айтемов ещё нет);
// - 'empty'     — терминальная задача без айтемов (itemsTotal===0) → текст emptyTerminalText;
// - 'counters'  — обычные счётчики Всего/Готово/Ошибки/Пропущено (running/paused/scheduling/терминал с N).
export type TaskStatsKind = 'collected' | 'empty' | 'counters'

export const taskStatsKind = (task: Pick<AutomationTask, 'status' | 'itemsTotal'>): TaskStatsKind => {
  if (task.status === 'draft') return 'collected'
  if (isTerminalStatus(task.status) && task.itemsTotal === 0) return 'empty'
  return 'counters'
}
