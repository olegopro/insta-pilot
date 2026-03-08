import type { Nullable } from 'src/shared/lib'

export interface InstagramAccount {
  id: number
  instagram_login: string
  full_name: Nullable<string>
  profile_pic_url: Nullable<string>
}

export interface LoginRequest {
  instagram_login: string
  instagram_password: string
  proxy?: string
}

export type LoginResponse = InstagramAccount
