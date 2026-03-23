import type {
  InstagramAccountApi,
  InstagramAccountDetailedApi,
  AddAccountRequestApi,
  DeviceProfileApi
} from '@/entities/instagram-account/model/apiTypes'
import type { InstagramAccount, InstagramAccountDetailed, AddAccountRequest, DeviceProfile } from '@/entities/instagram-account/model/types'
import { proxyImageUrl } from '@/shared/lib'

class InstagramAccountDTO {
  toLocal(data: InstagramAccountApi): InstagramAccount {
    return {
      id: data.id,
      instagramLogin: data.instagram_login,
      fullName: data.full_name,
      profilePicUrl: proxyImageUrl(data.profile_pic_url),
      deviceProfileId: data.device_profile_id,
      deviceModelName: data.device_model_name,
      isActive: data.is_active,
      createdAt: data.created_at
    }
  }

  toLocalList(data: InstagramAccountApi[]): InstagramAccount[] {
    return data.map((item) => this.toLocal(item))
  }

  toLocalDetailed(data: InstagramAccountDetailedApi): InstagramAccountDetailed {
    return {
      ...this.toLocal(data),
      userPk: data.user_pk,
      followersCount: data.followers_count,
      followingCount: data.following_count
    }
  }

  toLocalDeviceProfile(data: DeviceProfileApi): DeviceProfile {
    return {
      id: data.id,
      code: data.code,
      title: data.title
    }
  }

  toLocalDeviceProfiles(data: DeviceProfileApi[]): DeviceProfile[] {
    return data.map((item) => this.toLocalDeviceProfile(item))
  }

  toApiRequest(data: AddAccountRequest): AddAccountRequestApi {
    return {
      instagram_login: data.instagramLogin,
      instagram_password: data.instagramPassword,
      device_profile_id: data.deviceProfileId
    }
  }
}

export default new InstagramAccountDTO()
