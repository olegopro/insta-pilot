export interface Role {
  id: number
  name: string
  guard_name: string
}

export interface User {
  id: number
  name: string
  email: string
  is_active: boolean
  roles: Role[]
  created_at: string
  updated_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  user: User
  token: string
}
