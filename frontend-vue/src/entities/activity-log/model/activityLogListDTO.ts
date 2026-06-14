import type { ActivityLog } from '@/entities/activity-log/model/types'
import type { ActivityLogRowModel } from '@/entities/activity-log/model/activityLogTableColumns'
import type { Nullable } from '@/shared/lib'
import { ACTION_LABELS, ACTION_COLORS, STATUS_CONFIG, HTTP_CODE_COLOR } from '@/entities/activity-log/model/constants'
import { formatTimeHMS, formatDuration } from '@/shared/lib'

// Значения summary приходят как unknown (динамический JSON) — безопасно приводим
// к строке только примитивы, иначе пустая строка (избегаем '[object Object]').
const toText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : ''

export function summarizeResponse(summary: Nullable<Record<string, unknown>>): string {
  if (!summary) return ''

  if (summary.items_count !== undefined) return `${toText(summary.items_count)} записей`
  if (summary.results_count !== undefined) return `${toText(summary.results_count)} результатов`
  if (summary.comment_length !== undefined) return `${toText(summary.comment_length)} символов`
  if (summary.media_pk !== undefined) return `media: ${toText(summary.media_pk)}`
  if (summary.user_pk !== undefined) return `@${toText(summary.username ?? summary.user_pk)}`

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
