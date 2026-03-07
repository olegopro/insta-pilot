import type { InstagramProfile } from "src/types/instagram"

export interface LoginRequest {
  instagram_login: string
  instagram_password: string
  proxy?: string
}

export type LoginResponse = InstagramProfile
