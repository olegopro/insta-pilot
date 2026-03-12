import type { Nullable } from '@/shared/lib'

export interface MediaUserApi {
  pk: string
  username: string
  full_name: string
  profile_pic_url: Nullable<string>
}

export interface MediaResourceApi {
  pk: string
  media_type: number
  thumbnail_url: Nullable<string>
  video_url: Nullable<string>
}

export interface MediaPostApi {
  pk: string
  id: string
  code: string
  taken_at: string
  media_type: number
  thumbnail_url: Nullable<string>
  video_url: Nullable<string>
  caption_text: string
  like_count: number
  comment_count: number
  view_count: number
  has_liked: boolean
  user: MediaUserApi
  resources: MediaResourceApi[]
  location_name: Nullable<string>
}

export interface FeedResponseApi {
  posts: MediaPostApi[]
  next_max_id: Nullable<string>
  more_available: boolean
}

export interface InstagramUserDetailApi {
  pk: string
  username: string
  full_name: string
  profile_pic_url: Nullable<string>
  biography: string
  external_url: Nullable<string>
  is_private: boolean
  is_verified: boolean
  media_count: number
  follower_count: number
  following_count: number
}
