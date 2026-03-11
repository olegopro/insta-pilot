import { defineStore } from 'pinia'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import { api } from '@/boot/axios'
import type { User } from './types'

export const useAdminUsersStore = defineStore('adminUsers', () => {
  const listApi = useApi<ApiResponseWrapper<User[]>>(
    () => api.get('/admin/users').then((r) => r.data)
  )

  const toggleActiveApi = useApi<ApiResponseWrapper<User>, { id: number }>(
    ({ id }) => api.patch(`/admin/users/${id}/toggle-active`).then((r) => r.data)
  )

  const updateRoleApi = useApi<ApiResponseWrapper<User>, { id: number; role: string }>(
    ({ id, role }) => api.patch(`/admin/users/${id}/role`, { role }).then((r) => r.data)
  )

  const fetchUsers = () => listApi.execute()
  const toggleActive = (id: number) => toggleActiveApi.execute({ id })
  const updateRole = (id: number, role: string) => updateRoleApi.execute({ id, role })

  return { listApi, toggleActiveApi, updateRoleApi, fetchUsers, toggleActive, updateRole }
})
