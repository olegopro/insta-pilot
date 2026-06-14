import { describe, it, expect } from 'vitest'
import userDTO from '@/entities/user/model/userDTO'
import type { UserApi, RoleApi, AuthResponseApi } from '@/entities/user/model/apiTypes'

const makeRoleApi = (overrides: Partial<RoleApi> = {}): RoleApi => ({
  id:         1,
  name:       'admin',
  guard_name: 'web',
  ...overrides
})

const makeUserApi = (overrides: Partial<UserApi> = {}): UserApi => ({
  id:         1,
  name:       'Test User',
  email:      'test@example.com',
  is_active:  true,
  roles:      [makeRoleApi()],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  ...overrides
})

describe('userDTO.toLocalRole', () => it('маппит snake_case в camelCase (guard_name → guardName)', () => {
  const result = userDTO.toLocalRole(makeRoleApi({
    id:         5,
    name:       'user',
    guard_name: 'api'
  }))

  expect(result).toEqual({
    id:        5,
    name:      'user',
    guardName: 'api'
  })
}))

describe('userDTO.toLocal', () => {
  it('маппит snake_case в camelCase и passthrough id/name/email', () => {
    const result = userDTO.toLocal(makeUserApi())

    expect(result).toMatchObject({
      id:        1,
      name:      'Test User',
      email:     'test@example.com',
      isActive:  true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z'
    })
  })

  it('вложенный roles маппится через toLocalRole', () => {
    const result = userDTO.toLocal(makeUserApi({
      roles: [
        makeRoleApi({ id: 1, name: 'admin', guard_name: 'web' }),
        makeRoleApi({ id: 2, name: 'user', guard_name: 'api' })
      ]
    }))

    expect(result.roles).toEqual([
      { id: 1, name: 'admin', guardName: 'web' },
      { id: 2, name: 'user', guardName: 'api' }
    ])
  })

  it('пустой roles даёт пустой массив', () => {
    const result = userDTO.toLocal(makeUserApi({ roles: [] }))
    expect(result.roles).toEqual([])
  })

  it('isActive = false если is_active = false', () => {
    const result = userDTO.toLocal(makeUserApi({ is_active: false }))
    expect(result.isActive).toBe(false)
  })
})

describe('userDTO.toLocalList', () => {
  it('маппит массив пользователей', () => {
    const result = userDTO.toLocalList([
      makeUserApi({ id: 1 }),
      makeUserApi({ id: 2, email: 'second@example.com' })
    ])

    expect(result).toHaveLength(2)
    expect(result[1]!.email).toBe('second@example.com')
  })

  it('возвращает пустой массив при пустом входе', () => expect(userDTO.toLocalList([])).toEqual([]))
})

describe('userDTO.toLocalAuth', () => it('маппит user через toLocal и passthrough token', () => {
  const api: AuthResponseApi = {
    user:  makeUserApi(),
    token: 'jwt-token-123'
  }

  const result = userDTO.toLocalAuth(api)

  expect(result.token).toBe('jwt-token-123')
  expect(result.user).toMatchObject({
    id:       1,
    email:    'test@example.com',
    isActive: true
  })
  expect(result.user.roles).toEqual([{ id: 1, name: 'admin', guardName: 'web' }])
}))
