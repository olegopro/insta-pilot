import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { UserApi } from '@/entities/user/model/apiTypes'

vi.mock('@/boot/axios', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn()
  }
}))

import { api } from '@/boot/axios'
import { useAdminUsersStore } from '@/entities/user/model/adminUsersStore'

const mockUserApi: UserApi = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  is_active: true,
  roles: [{ id: 1, name: 'user', guard_name: 'web' }],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
}

describe('adminUsersStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchUsers вызывает GET /admin/users', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { success: true, data: [mockUserApi], message: 'OK' }
    })

    const store = useAdminUsersStore()
    await store.fetchUsers()

    expect(api.get).toHaveBeenCalledWith('/admin/users')
  })

  it('users содержит данные после fetchUsers (camelCase)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { success: true, data: [mockUserApi], message: 'OK' }
    })

    const store = useAdminUsersStore()
    await store.fetchUsers()

    expect(store.users).toMatchObject([{ id: 1, isActive: true }])
  })

  it('users = [] до вызова fetchUsers', () => {
    const store = useAdminUsersStore()

    expect(store.users).toEqual([])
  })

  it('toggleActive вызывает PATCH с нужным URL', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: { success: true, data: { ...mockUserApi, is_active: false }, message: 'OK' }
    })

    const store = useAdminUsersStore()
    await store.toggleActive(42)

    expect(api.patch).toHaveBeenCalledWith('/admin/users/42/toggle-active')
  })

  it('updateRole отправляет role в теле запроса', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: { success: true, data: { ...mockUserApi, roles: [{ id: 2, name: 'admin', guard_name: 'web' }] }, message: 'OK' }
    })

    const store = useAdminUsersStore()
    await store.updateRole(5, 'admin')

    expect(api.patch).toHaveBeenCalledWith('/admin/users/5/role', { role: 'admin' })
  })
})
