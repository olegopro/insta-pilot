import type {
  MediaPostApi,
  MediaUserApi,
  MediaResourceApi,
  InstagramUserDetailApi
} from './apiTypes'
import type { MediaPost, MediaUser, MediaResource, InstagramUserDetail } from './types'
import { proxyImageUrl } from '@/shared/lib'

class MediaPostDTO {
  toLocalUser(data: MediaUserApi): MediaUser {
    return {
      pk: data.pk,
      username: data.username,
      fullName: data.full_name,
      profilePicUrl: proxyImageUrl(data.profile_pic_url)
    }
  }

  toLocalResource(data: MediaResourceApi): MediaResource {
    return {
      pk: data.pk,
      mediaType: data.media_type,
      thumbnailUrl: data.thumbnail_url,
      videoUrl: data.video_url,
      width: data.width,
      height: data.height
    }
  }

  toLocalPost(data: MediaPostApi): MediaPost {
    return {
      pk: data.pk,
      id: data.id,
      code: data.code,
      takenAt: data.taken_at,
      mediaType: data.media_type,
      thumbnailUrl: data.thumbnail_url,
      videoUrl: data.video_url,
      captionText: data.caption_text,
      likeCount: data.like_count,
      commentCount: data.comment_count,
      viewCount: data.view_count,
      hasLiked: data.has_liked,
      user: this.toLocalUser(data.user),
      resources: data.resources.map((resource) => this.toLocalResource(resource)),
      locationName: data.location_name,
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
      profilePicUrl: proxyImageUrl(data.profile_pic_url),
      biography: data.biography,
      externalUrl: data.external_url,
      isPrivate: data.is_private,
      isVerified: data.is_verified,
      mediaCount: data.media_count,
      followerCount: data.follower_count,
      followingCount: data.following_count
    }
  }

  toLocal(data: MediaPostApi[]): MediaPost[] {
    return data.map((post) => this.toLocalPost(post))
  }
}

export default new MediaPostDTO()
