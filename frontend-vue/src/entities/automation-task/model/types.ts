import type { Nullable } from '@/shared/lib'
import type {
  AutomationActionType,
  AutomationMode
} from '@/entities/automation-parsing/model/types'

export type AutomationTaskStatus =
  | 'draft'
  | 'scheduling'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

// Конфиг действия. Для MVP заполнен только comment (см. configure-automation-action).
export interface CommentActionConfig {
  llmSettingId: Nullable<number>
  tone: Nullable<string>
  template: Nullable<string>
  useCaption: boolean
}

export interface AutomationTask {
  id: number
  instagramAccountId: number
  parseRunId: Nullable<number>
  mode: AutomationMode
  actionType: AutomationActionType
  status: AutomationTaskStatus
  targetCount: number
  spreadSeconds: number
  jitterSeconds: number
  respectWorkingHours: boolean
  itemsTotal: number
  itemsDone: number
  itemsFailed: number
  itemsSkipped: number
  collectedTargetsCount: number
  currentAction: Nullable<string>
  startedAt: Nullable<string>
  finishedAt: Nullable<string>
  createdAt: string
}

// Полезная нагрузка realtime-события .AutomationTaskProgress
export interface AutomationTaskProgressEvent {
  status: AutomationTaskStatus
  items_total: number
  items_done: number
  items_failed: number
  items_skipped: number
  current_action: Nullable<string>
}
