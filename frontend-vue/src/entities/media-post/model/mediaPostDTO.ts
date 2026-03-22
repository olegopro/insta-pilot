import type {
  MediaPostApi,
  MediaUserApi,
  MediaResourceApi,
  InstagramUserDetailApi,
  CommentUserApi,
  CommentApi
} from './apiTypes'
import type { MediaPost, MediaUser, MediaResource, InstagramUserDetail, CommentUser, PostComment } from './types'
import { proxyMediaUrl, proxyAvatarUrl } from '@/shared/lib'

class MediaPostDTO {
  toLocalUser(data: MediaUserApi): MediaUser {
    return {
      pk: data.pk,
      username: data.username,
      fullName: data.full_name,
      profilePicUrl: proxyAvatarUrl(data.profile_pic_url)
    }
  }

  toLocalResource(data: MediaResourceApi, accountId: number): MediaResource {
    return {
      pk: data.pk,
      mediaType: data.media_type,
      thumbnailUrl: proxyMediaUrl(data.thumbnail_url, accountId),
      videoUrl: proxyMediaUrl(data.video_url, accountId),
      originalThumbnailUrl: data.thumbnail_url,
      width: data.width,
      height: data.height
    }
  }

  toLocalPost(data: MediaPostApi, accountId: number): MediaPost {
    return {
      pk: data.pk,
      id: data.id,
      code: data.code,
      takenAt: data.taken_at,
      mediaType: data.media_type,
      thumbnailUrl: proxyMediaUrl(data.thumbnail_url, accountId),
      videoUrl: proxyMediaUrl(data.video_url, accountId),
      originalThumbnailUrl: data.thumbnail_url,
      captionText: data.caption_text,
      likeCount: data.like_count,
      commentCount: data.comment_count,
      viewCount: data.view_count,
      hasLiked: data.has_liked,
      user: this.toLocalUser(data.user),
      resources: data.resources.map((resource) => this.toLocalResource(resource, accountId)),
      locationName: data.location_name,
      locationPk: data.location_pk,
      thumbnailWidth: data.thumbnail_width,
      thumbnailHeight: data.thumbnail_height,
      videoWidth: data.video_width,
      videoHeight: data.video_height
    }
  }

  toLocalUserDetail(data: InstagramUserDetailApi): InstagramUserDetail {
    return {
      pk: data.pk,
      username: data.username,
      fullName: data.full_name,
      profilePicUrl: proxyAvatarUrl(data.profile_pic_url),
      biography: data.biography,
      externalUrl: data.external_url,
      isPrivate: data.is_private,
      isVerified: data.is_verified,
      mediaCount: data.media_count,
      followerCount: data.follower_count,
      followingCount: data.following_count
    }
  }

  toLocal(data: MediaPostApi[], accountId: number): MediaPost[] {
    return data.map((post) => this.toLocalPost(post, accountId))
  }

  toLocalCommentUser(data: CommentUserApi): CommentUser {
    return {
      pk: data.pk,
      username: data.username,
      fullName: data.full_name,
      profilePicUrl: proxyAvatarUrl(data.profile_pic_url)
    }
  }

  toLocalComment(data: CommentApi): PostComment {
    return {
      pk: data.pk,
      text: data.text,
      createdAtUtc: data.created_at_utc,
      likeCount: data.like_count,
      hasLiked: data.has_liked,
      repliedToCommentId: data.replied_to_comment_id,
      childCommentCount: data.child_comment_count,
      user: this.toLocalCommentUser(data.user),
      previewChildComments: data.preview_child_comments.map((child) => this.toLocalComment(child)),
      childComments: [],
      childCommentsCursor: null,
      childCommentsLoading: false
    }
  }

  toLocalComments(data: CommentApi[]): PostComment[] {
    return data.map((comment) => this.toLocalComment(comment))
  }
}

export default new MediaPostDTO()
