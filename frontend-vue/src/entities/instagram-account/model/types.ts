import type { Nullable } from '@/shared/lib'

export interface InstagramAccount {
  id: number
  instagramLogin: string
  fullName: Nullable<string>
  profilePicUrl: Nullable<string>
  proxy: Nullable<string>
  deviceProfileId: Nullable<number>
  deviceModelName: Nullable<string>
  isActive: boolean
  createdAt: string
}

export interface InstagramAccountDetailed extends InstagramAccount {
  userPk: Nullable<number>
  followersCount: Nullable<number>
  followingCount: Nullable<number>
}

export interface AddAccountRequest {
  instagramLogin: string
  instagramPassword: string
  proxy?: string
  deviceProfileId: number
}

export interface DeviceProfile {
  id: number
  code: string
  title: string
}
