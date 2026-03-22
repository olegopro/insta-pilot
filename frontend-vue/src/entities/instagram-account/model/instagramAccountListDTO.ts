import type { InstagramAccount } from './types'
import type { InstagramAccountRowModel } from './instagramAccountTableColumns'

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
