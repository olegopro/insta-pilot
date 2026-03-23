import type { ActivityLogApi } from '@/entities/activity-log/model/apiTypes'
import type { SidebarActivityEntry } from '@/entities/activity-log/model/types'
import { summarizeResponse } from '@/entities/activity-log/model/activityLogListDTO'

class SidebarActivityDTO {
  toLocal(event: ActivityLogApi): SidebarActivityEntry {
    const summary = summarizeResponse(event.response_summary ?? null)
    const shortMessage = event.error_message ?? (summary || null)

    return {
      id:           event.id,
      accountId:    event.instagram_account_id,
      accountLogin: event.instagram_login ?? '',
      action:       event.action,
      status:       event.status,
      httpCode:     event.http_code,
      shortMessage,
      durationMs:   event.duration_ms,
      createdAt:    event.created_at
    }
  }
}

export default new SidebarActivityDTO()
