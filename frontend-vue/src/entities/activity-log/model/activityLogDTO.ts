import type { Nullable } from '@/shared/lib'
import type { ActivityLogApi, ActivityStatsApi, AccountActivitySummaryApi, ActivityLogsResponseApi } from './apiTypes'
import type { ActivityLog, ActivityStats, AccountActivitySummary } from './types'

interface LogsResponse {
  items: ActivityLog[]
  hasMoreBefore: boolean
  hasMoreAfter: boolean
  total: number
  focusedId: Nullable<number>
}

class ActivityLogDTO {
  toLocal(item: ActivityLogApi): ActivityLog {
    return {
      id:                 item.id,
      instagramAccountId: item.instagram_account_id,
      instagramLogin:     item.instagram_login,
      userId:             item.user_id,
      action:             item.action,
      status:             item.status,
      httpCode:           item.http_code,
      endpoint:           item.endpoint,
      requestPayload:     item.request_payload,
      responseSummary:    item.response_summary,
      errorMessage:       item.error_message,
      errorCode:          item.error_code,
      durationMs:         item.duration_ms,
      createdAt:          item.created_at
    }
  }

  toLocalList(items: ActivityLogApi[]): ActivityLog[] {
    return items.map((item) => this.toLocal(item))
  }

  toLocalStats(data: ActivityStatsApi): ActivityStats {
    return {
      total:         data.total,
      today:         data.today,
      successRate:   data.success_rate,
      byAction:      data.by_action,
      byStatus:      data.by_status,
      avgDurationMs: data.avg_duration_ms,
      lastError:     data.last_error ? {
        action:       data.last_error.action,
        errorMessage: data.last_error.error_message,
        errorCode:    data.last_error.error_code,
        createdAt:    data.last_error.created_at
      } : null
    }
  }

  toLocalSummary(item: AccountActivitySummaryApi): AccountActivitySummary {
    return {
      accountId:       item.account_id,
      instagramLogin:  item.instagram_login,
      totalActions:    item.total_actions,
      todayActions:    item.today_actions,
      errorCountToday: item.error_count_today,
      successRate:     item.success_rate,
      lastActivityAt:  item.last_activity_at,
      lastError:       item.last_error,
      lastErrorAt:     item.last_error_at
    }
  }

  toLocalSummaryList(data: AccountActivitySummaryApi[]): AccountActivitySummary[] {
    return data.map((item) => this.toLocalSummary(item))
  }

  toLocalLogsResponse(data: ActivityLogsResponseApi): LogsResponse {
    return {
      items:         this.toLocalList(data.items),
      hasMoreBefore: data.has_more_before,
      hasMoreAfter:  data.has_more_after,
      total:         data.total,
      focusedId:     data.focused_id
    }
  }
}

export default new ActivityLogDTO()
