import type { AutomationTargetApi, TargetMetricsSnapshotApi } from '@/entities/automation-target/model/apiTypes'
import type { AutomationTarget, TargetMetricsSnapshot } from '@/entities/automation-target/model/types'
import { proxyImageUrl } from '@/shared/lib'
import type { Nullable } from '@/shared/lib'

class AutomationTargetDTO {
  private toMetrics(data: Nullable<TargetMetricsSnapshotApi>): Nullable<TargetMetricsSnapshot> {
    if (!data) return null
    return {
      likesSum: data.likes_sum ?? null,
      likesAvg: data.likes_avg ?? null,
      likesMin: data.likes_min ?? null,
      likesMax: data.likes_max ?? null,
      lastPostAgeDays: data.last_post_age_days ?? null,
      matchedWords: data.matched_words ?? []
    }
  }

  toLocal(data: AutomationTargetApi): AutomationTarget {
    return {
      id: data.id,
      parseRunId: data.parse_run_id,
      targetUserPk: data.target_user_pk,
      targetUsername: data.target_username,
      targetFullName: data.target_full_name,
      targetProfilePicUrl: proxyImageUrl(data.target_profile_pic_url),
      followerCount: data.follower_count,
      followingCount: data.following_count,
      mediaCount: data.media_count,
      isPrivate: data.is_private,
      isVerified: data.is_verified,
      mediaPk: data.media_pk,
      mediaId: data.media_id,
      mediaCaption: data.media_caption,
      mediaLikeCount: data.media_like_count,
      mediaCommentCount: data.media_comment_count,
      mediaTakenAt: data.media_taken_at,
      mediaThumbnailUrl: proxyImageUrl(data.media_thumbnail_url),
      metrics: this.toMetrics(data.metrics_snapshot),
      status: data.status
    }
  }

  toLocalList(data: AutomationTargetApi[]): AutomationTarget[] {
    return data.map((item) => this.toLocal(item))
  }
}

export default new AutomationTargetDTO()
