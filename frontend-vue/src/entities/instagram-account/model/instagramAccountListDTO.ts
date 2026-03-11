import type { InstagramAccount } from 'src/entities/instagram-account/model/types'
import type { InstagramAccountRowModel } from 'src/entities/instagram-account/model/instagramAccountTableColumns'

class InstagramAccountListDTO {
  toLocal(data: InstagramAccount[]): InstagramAccountRowModel[] {
    return data.map((item) => ({
      id: item.id,
      instagramLogin: item.instagram_login,
      fullName: item.full_name,
      isActive: item.is_active,
      createdAt: item.created_at
    }))
  }
}

export default new InstagramAccountListDTO()
