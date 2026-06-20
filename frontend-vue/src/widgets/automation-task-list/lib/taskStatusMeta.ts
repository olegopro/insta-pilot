import type { AutomationTaskStatus } from '@/entities/automation-task'

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

export const isTerminalStatus = (status: AutomationTaskStatus): boolean =>
  status === 'completed' || status === 'failed' || status === 'cancelled'
