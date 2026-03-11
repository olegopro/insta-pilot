import type { User } from '@/entities/user/model/types'
import type { UserRowModel } from '@/entities/user/model/adminUsersTableColumns'

class AdminUsersListDTO {
  toLocal(data: User[]): UserRowModel[] {
    return data.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.roles[0]?.name ?? 'user',
      isActive: item.is_active,
      createdAt: item.created_at
    }))
  }
}

export default new AdminUsersListDTO()
