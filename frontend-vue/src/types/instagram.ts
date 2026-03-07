import type { Nullable } from "."

export interface InstagramProfile {
  id: number
  instagram_login: string
  full_name: Nullable<string>
  profile_pic_url: Nullable<string>
}
