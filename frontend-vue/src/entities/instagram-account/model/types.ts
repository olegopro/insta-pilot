import type { Nullable } from 'src/shared/lib'

export interface InstagramAccount {
  id: number
  instagram_login: string
  full_name: Nullable<string>
  profile_pic_url: Nullable<string>
  proxy: Nullable<string>
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
}

export type AddAccountResponse = InstagramAccount
