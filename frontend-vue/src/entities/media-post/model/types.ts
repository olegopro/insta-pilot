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
  width: Nullable<number>
  height: Nullable<number>
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
  locationPk: Nullable<number>
  thumbnailWidth: Nullable<number>
  thumbnailHeight: Nullable<number>
  videoWidth: Nullable<number>
  videoHeight: Nullable<number>
}

export interface CommentUser {
  pk: string
  username: string
  fullName: string
  profilePicUrl: Nullable<string>
}

export interface PostComment {
  pk: string
  text: string
  createdAtUtc: string
  likeCount: number
  hasLiked: boolean
  repliedToCommentId: Nullable<string>
  childCommentCount: number
  user: CommentUser
  previewChildComments: PostComment[]
  childComments: PostComment[]
  childCommentsCursor: Nullable<string>
  childCommentsLoading: boolean
}

export interface Location {
  pk: number
  name: string
  address: string
  lat: number
  lng: number
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
