import type { Nullable } from '@/shared/lib'

export type LimitAction = 'like' | 'comment' | 'follow' | 'unfollow'

export interface ActionLimit {
  action: LimitAction
  dailyLimit: number
  minActionSpacingSec: Nullable<number>
  isActive: boolean
}

export interface WorkingHours {
  // Матрица 7×24: дни недели × часы (true = рабочий слот).
  schedule: boolean[][]
  timezone: string
  isEnabled: boolean
}

export interface AccountSettings {
  limits: ActionLimit[]
  workingHours: WorkingHours
}
