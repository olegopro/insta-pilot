import { describe, it, expect } from 'vitest'
import adminUsersListDTO from '@/entities/user/model/adminUsersListDTO'
import type { User } from '@/entities/user/model/types'

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  isActive: true,
  roles: [{ id: 1, name: 'user', guardName: 'web' }],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides
})

describe('adminUsersListDTO.toLocal', () => {
  it('маппит поля в UserRowModel', () => {
    const result = adminUsersListDTO.toLocal([makeUser()])

    expect(result[0]).toMatchObject({
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z'
    })
  })

  it('берёт первую роль из массива roles', () => {
    const user = makeUser({ roles: [{ id: 2, name: 'admin', guardName: 'web' }] })

    const result = adminUsersListDTO.toLocal([user])

    expect(result).toMatchObject([{ role: 'admin' }])
  })

  it('role = "user" если roles пустой массив', () => {
    const user = makeUser({ roles: [] })

    const result = adminUsersListDTO.toLocal([user])

    expect(result).toMatchObject([{ role: 'user' }])
  })

  it('возвращает пустой массив при пустом входе', () => {
    expect(adminUsersListDTO.toLocal([])).toEqual([])
  })

  it('маппит несколько пользователей', () => {
    const users = [makeUser({ id: 1 }), makeUser({ id: 2, email: 'second@example.com' })]

    const result = adminUsersListDTO.toLocal(users)

    expect(result).toHaveLength(2)
    expect(result).toMatchObject([{}, { email: 'second@example.com' }])
  })
})
