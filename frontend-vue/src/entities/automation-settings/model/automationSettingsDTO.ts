import type {
  AccountSettingsApi,
  ActionLimitApi,
  UpdateLimitsRequestApi,
  UpdateWorkingHoursRequestApi,
  WorkingHoursApi
} from '@/entities/automation-settings/model/apiTypes'
import type {
  AccountSettings,
  ActionLimit,
  WorkingHours
} from '@/entities/automation-settings/model/types'

class AutomationSettingsDTO {
  private toLimit(data: ActionLimitApi): ActionLimit {
    return {
      action: data.action,
      dailyLimit: data.daily_limit,
      minActionSpacingSec: data.min_action_spacing_sec,
      isActive: data.is_active
    }
  }

  private toWorkingHours(data: WorkingHoursApi): WorkingHours {
    return {
      schedule: data.schedule,
      timezone: data.timezone,
      isEnabled: data.is_enabled
    }
  }

  toLocal(data: AccountSettingsApi): AccountSettings {
    return {
      limits: data.limits.map((limit) => this.toLimit(limit)),
      workingHours: this.toWorkingHours(data.working_hours)
    }
  }

  limitsToApi(limits: ActionLimit[]): UpdateLimitsRequestApi {
    return {
      limits: limits.map((limit) => ({
        action: limit.action,
        daily_limit: limit.dailyLimit,
        min_action_spacing_sec: limit.minActionSpacingSec,
        is_active: limit.isActive
      }))
    }
  }

  workingHoursToApi(workingHours: WorkingHours): UpdateWorkingHoursRequestApi {
    return {
      schedule: workingHours.schedule,
      timezone: workingHours.timezone,
      is_enabled: workingHours.isEnabled
    }
  }
}

export default new AutomationSettingsDTO()
