export interface RoleApi {
  id: number
  name: string
  guard_name: string
}

export interface UserApi {
  id: number
  name: string
  email: string
  is_active: boolean
  roles: RoleApi[]
  created_at: string
  updated_at: string
}

export interface LoginRequestApi {
  email: string
  password: string
}

export interface AuthResponseApi {
  user: UserApi
  token: string
}
