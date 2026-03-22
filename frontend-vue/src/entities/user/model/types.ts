export interface Role {
  id: number
  name: string
  guardName: string
}

export interface User {
  id: number
  name: string
  email: string
  isActive: boolean
  roles: Role[]
  createdAt: string
  updatedAt: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  user: User
  token: string
}
