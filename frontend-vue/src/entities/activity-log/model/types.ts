import type { Nullable } from '@/shared/lib'
import { ACTION_LABELS } from '@/entities/activity-log'

export type ActionType =
  | 'login'
  | 'fetch_feed'
  | 'like'
  | 'comment'
  | 'search_hashtag'
  | 'search_locations'
  | 'search_location_medias'
  | 'fetch_user_info'
  | 'generate_comment'
  | 'fetch_comments'
  | 'fetch_comment_replies'

export type ActionStatus =
  | 'success'
  | 'error'
  | 'rate_limited'
  | 'challenge_required'
  | 'login_required'
  | 'timeout'

export interface ActivityLog {
  id: number
  instagramAccountId: number
  instagramLogin: Nullable<string>
  userId: number
  action: ActionType
  status: ActionStatus
  httpCode: Nullable<number>
  endpoint: Nullable<string>
  requestPayload: Nullable<Record<string, unknown>>
  responseSummary: Nullable<Record<string, unknown>>
  errorMessage: Nullable<string>
  errorCode: Nullable<string>
  durationMs: Nullable<number>
  createdAt: string
}

export interface ActionBreakdown {
  total: number
  success: number
  error: number
}

export interface ActivityStats {
  total: number
  today: number
  successRate: number
  byAction: Record<string, ActionBreakdown>
  byStatus: Record<string, number>
  avgDurationMs: number
  lastError: Nullable<{
    action: string
    errorMessage: string
    errorCode: Nullable<string>
    createdAt: string
  }>
}

export interface AccountActivitySummary {
  accountId: number
  instagramLogin: string
  totalActions: number
  todayActions: number
  errorCountToday: number
  successRate: number
  lastActivityAt: Nullable<string>
  lastError: Nullable<string>
  lastErrorAt: Nullable<string>
}

export interface ActivityFilters {
  action?: ActionType
  status?: ActionStatus
  httpCode?: number
  dateFrom?: string
  dateTo?: string
}

export type QuickFilter = 'all' | 'errors' | 'likes' | 'comments'

export interface SidebarActivityEntry {
  id: number
  accountId: number
  accountLogin: string
  action: ActionType
  status: ActionStatus
  httpCode: Nullable<number>
  shortMessage: Nullable<string>
  durationMs: Nullable<number>
  createdAt: string
}
