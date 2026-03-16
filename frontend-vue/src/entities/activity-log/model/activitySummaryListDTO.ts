import type { AccountActivitySummary } from './types'
import type { SummaryRowModel } from './activitySummaryTableColumns'
import { formatTimeHM } from '@/shared/lib'

class ActivitySummaryListDTO {
  toLocal(data: AccountActivitySummary[]): SummaryRowModel[] {
    return data.map((item) => ({
      accountId:       item.accountId,
      instagramLogin:  item.instagramLogin,
      totalActions:    item.totalActions,
      todayActions:    item.todayActions,
      errorCountToday: item.errorCountToday,
      successRate:     `${item.successRate.toFixed(1)}%`,
      lastActivityAt:  formatTimeHM(item.lastActivityAt),
      lastError:       item.lastError
    }))
  }
}

export default new ActivitySummaryListDTO()
