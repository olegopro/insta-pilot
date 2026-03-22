import type { User } from './types'
import type { UserRowModel } from './adminUsersTableColumns'

class AdminUsersListDTO {
  toLocal(data: User[]): UserRowModel[] {
    return data.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.roles[0]?.name ?? 'user',
      isActive: item.isActive,
      createdAt: item.createdAt
    }))
  }
}

export default new AdminUsersListDTO()
