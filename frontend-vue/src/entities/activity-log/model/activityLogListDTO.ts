import type { ActivityLog } from '@/entities/activity-log/model/types'
import type { ActivityLogRowModel } from '@/entities/activity-log/model/activityLogTableColumns'
import type { Nullable } from '@/shared/lib'
import { ACTION_LABELS, ACTION_COLORS, STATUS_CONFIG, HTTP_CODE_COLOR } from '@/entities/activity-log/model/constants'
import { formatTimeHMS, formatDuration } from '@/shared/lib'

export function summarizeResponse(summary: Nullable<Record<string, unknown>>): string {
  if (!summary) return ''

  if (summary.items_count !== undefined) return `${String(summary.items_count as string | number)} записей`
  if (summary.results_count !== undefined) return `${String(summary.results_count as string | number)} результатов`
  if (summary.comment_length !== undefined) return `${String(summary.comment_length as string | number)} символов`
  if (summary.media_pk !== undefined) return `media: ${String(summary.media_pk as string | number)}`
  if (summary.user_pk !== undefined) return `@${String((summary.username ?? summary.user_pk) as string | number)}`

  return ''
}

class ActivityLogListDTO {
  toLocal(data: ActivityLog[]): ActivityLogRowModel[] {
    return data.map((item) => {
      const statusConfig = STATUS_CONFIG[item.status]
      const duration = formatDuration(item.durationMs)

      return {
        id:                  item.id,
        action:              item.action,
        actionLabel:         ACTION_LABELS[item.action],
        actionColor:         ACTION_COLORS[item.action],
        status:              item.status,
        statusIcon:          statusConfig.icon,
        statusColor:         statusConfig.color,
        statusLabel:         statusConfig.label,
        httpCode:            item.httpCode,
        httpCodeColor:       HTTP_CODE_COLOR(item.httpCode),
        endpoint:            item.endpoint,
        errorMessage:        item.errorMessage,
        errorCode:           item.errorCode,
        durationMs:          item.durationMs,
        durationFormatted:   duration.text,
        durationColor:       duration.color,
        responseSummaryText: summarizeResponse(item.responseSummary),
        requestPayload:      item.requestPayload,
        responseSummary:     item.responseSummary,
        createdAt:           item.createdAt,
        timeFormatted:       formatTimeHMS(item.createdAt)
      }
    })
  }
}

export default new ActivityLogListDTO()
