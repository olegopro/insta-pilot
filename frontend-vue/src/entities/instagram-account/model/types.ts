import type { Nullable } from '@/shared/lib'

export interface InstagramAccount {
  id: number
  instagram_login: string
  full_name: Nullable<string>
  profile_pic_url: Nullable<string>
  proxy: Nullable<string>
  device_profile_id: Nullable<number>
  device_model_name: Nullable<string>
  is_active: boolean
  created_at: string
}

export interface InstagramAccountDetailed extends InstagramAccount {
  followers_count: Nullable<number>
  following_count: Nullable<number>
}

export interface AddAccountRequest {
  instagram_login: string
  instagram_password: string
  proxy?: string
  device_profile_id: number
}

export type AddAccountResponse = InstagramAccount

export interface DeviceProfile {
  id: number
  code: string
  title: string
}
