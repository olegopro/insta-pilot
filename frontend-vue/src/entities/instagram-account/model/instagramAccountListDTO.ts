import type { InstagramAccount } from '@/entities/instagram-account/model/types'
import type { InstagramAccountRowModel } from '@/entities/instagram-account/model/instagramAccountTableColumns'

class InstagramAccountListDTO {
  toLocal(data: InstagramAccount[]): InstagramAccountRowModel[] {
    return data.map((item) => ({
      id: item.id,
      instagramLogin: item.instagramLogin,
      fullName: item.fullName,
      deviceModelName: item.deviceModelName,
      isActive: item.isActive,
      createdAt: item.createdAt
    }))
  }
}

export default new InstagramAccountListDTO()
