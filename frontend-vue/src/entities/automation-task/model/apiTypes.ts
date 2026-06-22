import type { Nullable } from '@/shared/lib'

export interface CommentActionConfigApi {
  llm_setting_id?: Nullable<number>
  tone?: Nullable<string>
  template?: Nullable<string>
  use_caption?: boolean
}

export interface AutomationTaskApi {
  id: number
  instagram_account_id: number
  parse_run_id: Nullable<number>
  mode: 'semi_auto' | 'full_auto'
  action_type: 'comment' | 'like' | 'follow' | 'unfollow'
  status: string
  target_count: number
  spread_seconds: number
  jitter_seconds: number
  respect_working_hours: boolean
  items_total: number
  items_done: number
  items_failed: number
  items_skipped: number
  collected_targets_count: number
  current_action: Nullable<string>
  started_at: Nullable<string>
  finished_at: Nullable<string>
  created_at: string
}

export type AutomationTasksResponseApi = AutomationTaskApi[]

// Тело POST /automation/{id}/start — опциональное ручное распределение во времени.
// Пусто/нет — равномерно из spread_seconds (обратная совместимость + full_auto).
export interface AutomationScheduleEntryApi {
  parsed_target_id: number
  offset_seconds: number
}

export interface StartAutomationTaskRequestApi {
  window_seconds: number
  schedule: AutomationScheduleEntryApi[]
}

// Тело POST /automation (создание задачи + запуск парсинга на бэке).
export interface CreateAutomationTaskRequestApi {
  instagram_account_id: number
  mode: 'semi_auto' | 'full_auto'
  action_type: 'comment' | 'like' | 'follow' | 'unfollow'
  source: {
    type: string
    value: Record<string, unknown>
  }
  filters: Record<string, unknown>
  target_count: number
  action_config: Record<string, unknown>
}
