import type { AutomationTarget } from '@/entities/automation-target'
import type { MediaPost } from '@/entities/media-post'

// Адаптация спарсенной цели в MediaPost для рендера в плиточном виде (MasonryGrid + MediaCard).
// Адаптация живёт ЗДЕСЬ (в виджете), а не в entity — это presentation-склейка двух доменов.
export const targetToMediaPost = (target: AutomationTarget): MediaPost => ({
  pk: target.mediaPk ?? String(target.id),
  id: target.mediaId ?? String(target.id),
  code: '',
  takenAt: target.mediaTakenAt ?? '',
  mediaType: 1,
  thumbnailUrl: target.mediaThumbnailUrl,
  videoUrl: null,
  originalThumbnailUrl: target.mediaThumbnailUrl,
  captionText: target.mediaCaption ?? '',
  likeCount: target.mediaLikeCount ?? 0,
  commentCount: target.mediaCommentCount ?? 0,
  viewCount: 0,
  hasLiked: false,
  user: {
    pk: target.targetUserPk,
    username: target.targetUsername,
    fullName: target.targetFullName ?? '',
    profilePicUrl: target.targetProfilePicUrl
  },
  resources: [],
  locationName: null,
  locationPk: null,
  thumbnailWidth: 1,
  thumbnailHeight: 1,
  videoWidth: null,
  videoHeight: null
})

export const targetsToMediaPosts = (targets: AutomationTarget[]): MediaPost[] =>
  targets.map((target) => targetToMediaPost(target))
