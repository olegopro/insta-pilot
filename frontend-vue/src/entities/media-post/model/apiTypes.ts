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
  width: Nullable<number>
  height: Nullable<number>
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
  thumbnail_width: Nullable<number>
  thumbnail_height: Nullable<number>
  video_width: Nullable<number>
  video_height: Nullable<number>
}

export interface FeedResponseApi {
  posts: MediaPostApi[]
  next_max_id: Nullable<string>
  more_available: boolean
}

export interface SearchResponseApi {
  items: MediaPostApi[]
}

export interface LocationApi {
  pk: number
  name: string
  address: string
  lat: number
  lng: number
}

export interface SearchLocationsResponseApi {
  locations: LocationApi[]
}

export interface SendCommentResponseApi {
  comment_pk: Nullable<string>
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
