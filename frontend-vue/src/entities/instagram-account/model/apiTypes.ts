import type { Nullable } from '@/shared/lib'

export interface InstagramAccountApi {
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

export interface InstagramAccountDetailedApi extends InstagramAccountApi {
  user_pk: Nullable<number>
  followers_count: Nullable<number>
  following_count: Nullable<number>
}

export interface AddAccountRequestApi {
  instagram_login: string
  instagram_password: string
  proxy?: string
  device_profile_id: number
}

export type AddAccountResponseApi = InstagramAccountApi

export interface DeviceProfileApi {
  id: number
  code: string
  title: string
}
