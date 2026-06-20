import type { Nullable } from '@/shared/lib'

export type AutomationTargetStatus = 'kept' | 'trashed'

export interface TargetMetricsSnapshot {
  likesSum: Nullable<number>
  likesAvg: Nullable<number>
  likesMin: Nullable<number>
  likesMax: Nullable<number>
  lastPostAgeDays: Nullable<number>
  matchedWords: string[]
}

export interface AutomationTarget {
  id: number
  parseRunId: number
  targetUserPk: string
  targetUsername: string
  targetFullName: Nullable<string>
  targetProfilePicUrl: Nullable<string>
  followerCount: Nullable<number>
  followingCount: Nullable<number>
  mediaCount: Nullable<number>
  isPrivate: boolean
  isVerified: boolean
  mediaPk: Nullable<string>
  mediaId: Nullable<string>
  mediaCaption: Nullable<string>
  mediaLikeCount: Nullable<number>
  mediaCommentCount: Nullable<number>
  mediaTakenAt: Nullable<string>
  mediaThumbnailUrl: Nullable<string>
  metrics: Nullable<TargetMetricsSnapshot>
  status: AutomationTargetStatus
}
