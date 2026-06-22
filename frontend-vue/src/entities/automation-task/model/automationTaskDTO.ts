import type { AutomationTaskApi } from '@/entities/automation-task/model/apiTypes'
import type { AutomationTask, AutomationTaskStatus } from '@/entities/automation-task/model/types'

class AutomationTaskDTO {
  toLocal(data: AutomationTaskApi): AutomationTask {
    return {
      id: data.id,
      instagramAccountId: data.instagram_account_id,
      parseRunId: data.parse_run_id,
      mode: data.mode,
      actionType: data.action_type,
      status: data.status as AutomationTaskStatus,
      targetCount: data.target_count,
      spreadSeconds: data.spread_seconds,
      jitterSeconds: data.jitter_seconds,
      respectWorkingHours: data.respect_working_hours,
      itemsTotal: data.items_total,
      itemsDone: data.items_done,
      itemsFailed: data.items_failed,
      itemsSkipped: data.items_skipped,
      collectedTargetsCount: data.collected_targets_count,
      currentAction: data.current_action,
      startedAt: data.started_at,
      finishedAt: data.finished_at,
      createdAt: data.created_at
    }
  }

  toLocalList(data: AutomationTaskApi[]): AutomationTask[] {
    return data.map((item) => this.toLocal(item))
  }
}

export default new AutomationTaskDTO()
