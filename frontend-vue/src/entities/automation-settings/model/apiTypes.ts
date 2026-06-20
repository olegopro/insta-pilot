import type { Nullable } from '@/shared/lib'

export interface ActionLimitApi {
  action: 'like' | 'comment' | 'follow' | 'unfollow'
  daily_limit: number
  min_action_spacing_sec: Nullable<number>
  is_active: boolean
}

export interface WorkingHoursApi {
  schedule: boolean[][]
  timezone: string
  is_enabled: boolean
}

export interface AccountSettingsApi {
  limits: ActionLimitApi[]
  working_hours: WorkingHoursApi
}

export interface UpdateLimitsRequestApi {
  limits: ActionLimitApi[]
}

export type UpdateWorkingHoursRequestApi = WorkingHoursApi
