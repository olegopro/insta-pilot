import type { ActionLimit, LimitAction, WorkingHours } from '@/entities/automation-settings/model/types'

// Дневные дефолты из §9: like 80–100/день, comment 30/день, follow/unfollow 50/день.
export const DEFAULT_DAILY_LIMITS: Record<LimitAction, number> = {
  like: 90,
  comment: 30,
  follow: 50,
  unfollow: 50
}

export const LIMIT_ACTION_LABELS: Record<LimitAction, string> = {
  like: 'Лайки',
  comment: 'Комментарии',
  follow: 'Подписки',
  unfollow: 'Отписки'
}

export const LIMIT_ACTIONS: LimitAction[] = ['like', 'comment', 'follow', 'unfollow']

export const createDefaultLimits = (): ActionLimit[] =>
  LIMIT_ACTIONS.map((action) => ({
    action,
    dailyLimit: DEFAULT_DAILY_LIMITS[action],
    minActionSpacingSec: 60,
    isActive: true
  }))

export const createEmptySchedule = (): boolean[][] =>
  Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => false))

// Дефолт рабочих часов — будни 9–21 заполнены.
export const createDefaultSchedule = (): boolean[][] =>
  Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => day < 5 && hour >= 9 && hour < 21)
  )

export const createDefaultWorkingHours = (): WorkingHours => ({
  schedule: createDefaultSchedule(),
  timezone: 'UTC',
  isEnabled: true
})
