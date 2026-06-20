import type { AutomationTarget } from '@/entities/automation-target/model/types'
import type { AutomationTargetRowModel } from '@/entities/automation-target/model/automationTargetTableColumns'

class AutomationTargetListDTO {
  toLocal(data: AutomationTarget[]): AutomationTargetRowModel[] {
    return data.map((item) => ({
      id: item.id,
      username: item.targetUsername,
      fullName: item.targetFullName,
      followerCount: item.followerCount,
      followingCount: item.followingCount,
      likesAvg: item.metrics?.likesAvg ?? null,
      lastPostAgeDays: item.metrics?.lastPostAgeDays ?? null,
      isPrivate: item.isPrivate,
      isVerified: item.isVerified,
      status: item.status
    }))
  }
}

export default new AutomationTargetListDTO()
