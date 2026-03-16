import type { ActivityLog } from './types'
import type { ActivityLogRowModel } from './activityLogTableColumns'
import type { Nullable } from '@/shared/lib'
import { ACTION_LABELS, ACTION_COLORS, STATUS_CONFIG, HTTP_CODE_COLOR } from './constants'
import { formatTimeHMS } from '@/shared/lib'

function formatDuration(durationMs: Nullable<number>): { text: string; color: string } {
  if (durationMs === null) return { text: '—', color: '' }
  if (durationMs >= 3000) return { text: `${(durationMs / 1000).toFixed(1)}s`, color: 'negative' }
  if (durationMs >= 1000) return { text: `${(durationMs / 1000).toFixed(1)}s`, color: 'warning' }
  return { text: `${String(durationMs)}ms`, color: '' }
}

export function summarizeResponse(summary: Nullable<Record<string, unknown>>): string {
  if (!summary) return ''
  const getValue = (key: string) => summary[key]
  if (getValue('items_count') !== undefined) return `${String(getValue('items_count') as string | number)} записей`
  if (getValue('results_count') !== undefined) return `${String(getValue('results_count') as string | number)} результатов`
  if (getValue('comment_length') !== undefined) return `${String(getValue('comment_length') as string | number)} символов`
  if (getValue('media_pk') !== undefined) return `media: ${String(getValue('media_pk') as string | number)}`
  if (getValue('user_pk') !== undefined) return `@${String((getValue('username') ?? getValue('user_pk')) as string | number)}`
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
