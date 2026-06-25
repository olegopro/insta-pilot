import type { ShowcaseProfileApi, ShowcaseOverlayApi, ShowcaseMediaApi } from '@/entities/showcase-media/model/apiTypes'
import type { ShowcaseProfile, ShowcaseOverlay, ShowcaseMedia } from '@/entities/showcase-media/model/types'
import { proxyImageUrl } from '@/shared/lib'
import mediaPostDTO from '@/entities/media-post/model/mediaPostDTO'

class ShowcaseMediaDTO {
  toLocalProfile(data: ShowcaseProfileApi): ShowcaseProfile {
    return {
      userPk: data.user_pk,
      username: data.username,
      fullName: data.full_name,
      profilePicUrl: proxyImageUrl(data.profile_pic_url),
      biography: data.biography,
      mediaCount: data.media_count,
      followerCount: data.follower_count,
      followingCount: data.following_count,
      isPrivate: data.is_private,
      isVerified: data.is_verified
    }
  }

  toLocalOverlay(data: ShowcaseOverlayApi): ShowcaseOverlay {
    return {
      boardPosition: data.board_position,
      isAd: data.is_ad,
      isTracked: data.is_tracked,
      isHiddenLocal: data.is_hidden_local,
      note: data.note,
      labels: data.labels
    }
  }

  toLocalMedia(data: ShowcaseMediaApi): ShowcaseMedia {
    return {
      post: mediaPostDTO.toLocalPost(data),
      isPinned: data.is_pinned,
      overlay: this.toLocalOverlay(data.overlay)
    }
  }

  toLocal(data: ShowcaseMediaApi[]): ShowcaseMedia[] {
    return data.map((media) => this.toLocalMedia(media))
  }
}

export default new ShowcaseMediaDTO()
