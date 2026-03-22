import type { UserApi, RoleApi, AuthResponseApi } from './apiTypes'
import type { User, Role, AuthResponse } from './types'

class UserDTO {
  toLocalRole(data: RoleApi): Role {
    return {
      id: data.id,
      name: data.name,
      guardName: data.guard_name
    }
  }

  toLocal(data: UserApi): User {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      isActive: data.is_active,
      roles: data.roles.map((role) => this.toLocalRole(role)),
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }
  }

  toLocalList(data: UserApi[]): User[] {
    return data.map((item) => this.toLocal(item))
  }

  toLocalAuth(data: AuthResponseApi): AuthResponse {
    return {
      user: this.toLocal(data.user),
      token: data.token
    }
  }
}

export default new UserDTO()
