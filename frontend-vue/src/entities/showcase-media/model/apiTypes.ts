import type { Nullable } from '@/shared/lib'
import type { MediaPostApi } from '@/entities/media-post/model/apiTypes'

export interface ShowcaseProfileApi {
  user_pk: string
  username: string
  full_name: string
  profile_pic_url: Nullable<string>
  biography: string
  media_count: number
  follower_count: number
  following_count: number
  is_private: boolean
  is_verified: boolean
}

export interface ShowcaseOverlayApi {
  board_position: Nullable<number>
  is_ad: boolean
  is_tracked: boolean
  is_hidden_local: boolean
  note: Nullable<string>
  labels: Nullable<string[]>
}

export interface ShowcaseMediaApi extends MediaPostApi {
  is_pinned: boolean
  overlay: ShowcaseOverlayApi
}

export interface ShowcaseMediasResponseApi {
  posts: ShowcaseMediaApi[]
  next_cursor: Nullable<string>
  more_available: boolean
}
