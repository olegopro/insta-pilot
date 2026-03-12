import type { Nullable } from '@/shared/lib'

export interface MediaUser {
  pk: string
  username: string
  fullName: string
  profilePicUrl: Nullable<string>
}

export interface MediaResource {
  pk: string
  mediaType: number
  thumbnailUrl: Nullable<string>
  videoUrl: Nullable<string>
}

export interface MediaPost {
  pk: string
  id: string
  code: string
  takenAt: string
  mediaType: number
  thumbnailUrl: Nullable<string>
  videoUrl: Nullable<string>
  captionText: string
  likeCount: number
  commentCount: number
  viewCount: number
  hasLiked: boolean
  user: MediaUser
  resources: MediaResource[]
  locationName: Nullable<string>
}

export interface InstagramUserDetail {
  pk: string
  username: string
  fullName: string
  profilePicUrl: Nullable<string>
  biography: string
  externalUrl: Nullable<string>
  isPrivate: boolean
  isVerified: boolean
  mediaCount: number
  followerCount: number
  followingCount: number
}
