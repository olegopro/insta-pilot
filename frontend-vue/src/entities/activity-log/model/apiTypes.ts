import type { Nullable } from '@/shared/lib'
import type { ActionType, ActionStatus } from './types'

export interface ActivityLogApi {
  id: number
  instagram_account_id: number
  instagram_login: Nullable<string>
  user_id: number
  action: ActionType
  status: ActionStatus
  http_code: Nullable<number>
  endpoint: Nullable<string>
  request_payload: Nullable<Record<string, unknown>>
  response_summary: Nullable<Record<string, unknown>>
  error_message: Nullable<string>
  error_code: Nullable<string>
  duration_ms: Nullable<number>
  created_at: string
}

export interface ActivityStatsApi {
  total: number
  today: number
  success_rate: number
  by_action: Record<string, { total: number; success: number; error: number }>
  by_status: Record<string, number>
  avg_duration_ms: number
  last_error: Nullable<{
    action: string
    error_message: string
    error_code: Nullable<string>
    created_at: string
  }>
}

export interface AccountActivitySummaryApi {
  account_id: number
  instagram_login: string
  total_actions: number
  today_actions: number
  error_count_today: number
  success_rate: number
  last_activity_at: Nullable<string>
  last_error: Nullable<string>
  last_error_at: Nullable<string>
}

export interface ActivityLogsResponseApi {
  items: ActivityLogApi[]
  has_more_before: boolean
  has_more_after: boolean
  total: number
  focused_id: Nullable<number>
}
