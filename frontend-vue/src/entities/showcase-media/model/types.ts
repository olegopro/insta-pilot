import type { Nullable } from '@/shared/lib'
import type { MediaPost } from '@/entities/media-post'

export interface ShowcaseProfile {
  userPk: string
  username: string
  fullName: string
  profilePicUrl: Nullable<string>
  biography: string
  mediaCount: number
  followerCount: number
  followingCount: number
  isPrivate: boolean
  isVerified: boolean
}

export interface ShowcaseOverlay {
  boardPosition: Nullable<number>
  isAd: boolean
  isTracked: boolean
  isHiddenLocal: boolean
  note: Nullable<string>
  labels: Nullable<string[]>
}

export interface ShowcaseMedia {
  post: MediaPost
  isPinned: boolean
  overlay: ShowcaseOverlay
}
