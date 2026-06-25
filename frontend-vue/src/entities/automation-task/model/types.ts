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

// Фаза асинхронного сбора целей для черновика: идёт парсинг / собрано (готово) / провал.
// Отделена от AutomationTaskStatus — пока статус задачи остаётся 'draft', фаза уточняет,
// на каком этапе сбор целей.
export type AutomationParseStatus = 'parsing' | 'done' | 'failed'

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
  // Фаза сбора целей (см. AutomationParseStatus). null — фаза неизвестна (бэк ещё не
  // прислал поле / задача создана до появления контракта): фронт деградирует к
  // draft/ready по collectedTargetsCount.
  parseStatus: Nullable<AutomationParseStatus>
  // Текст причины при parseStatus='failed' (например, challenge_required). Иначе null.
  parseError: Nullable<string>
  currentAction: Nullable<string>
  startedAt: Nullable<string>
  finishedAt: Nullable<string>
  createdAt: string
}

// Полезная нагрузка realtime-события .AutomationTaskProgress
export interface AutomationTaskProgressEvent {
  // На execution-событиях — статус задачи; на фазе парсинга (current_action='parsing')
  // дополнительно приходит 'parsing' (сбор ещё идёт).
  status: AutomationTaskStatus | 'parsing'
  items_total: number
  items_done: number
  items_failed: number
  items_skipped: number
  current_action: Nullable<string>
  // Число собранных (kept) целей на фазе парсинга. Опционально: приходит в parse-событиях.
  collected?: number
  // Текст причины при status='failed' (например, challenge_required на парсинге). Опционален:
  // приходит только на терминальном провале, в остальных событиях отсутствует.
  error_message?: Nullable<string>
}
