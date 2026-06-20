import type { Nullable } from '@/shared/lib'

// Снимок метрик цели на момент парсинга (см. parsed_targets.metrics_snapshot).
export interface TargetMetricsSnapshotApi {
  likes_sum?: Nullable<number>
  likes_avg?: Nullable<number>
  likes_min?: Nullable<number>
  likes_max?: Nullable<number>
  last_post_age_days?: Nullable<number>
  matched_words?: string[]
}

export interface AutomationTargetApi {
  id: number
  parse_run_id: number
  target_user_pk: string
  target_username: string
  target_full_name: Nullable<string>
  target_profile_pic_url: Nullable<string>
  follower_count: Nullable<number>
  following_count: Nullable<number>
  media_count: Nullable<number>
  is_private: boolean
  is_verified: boolean
  media_pk: Nullable<string>
  media_id: Nullable<string>
  media_caption: Nullable<string>
  media_like_count: Nullable<number>
  media_comment_count: Nullable<number>
  media_taken_at: Nullable<string>
  media_thumbnail_url: Nullable<string>
  metrics_snapshot: Nullable<TargetMetricsSnapshotApi>
  status: 'kept' | 'trashed'
}

export type AutomationTargetsResponseApi = AutomationTargetApi[]
