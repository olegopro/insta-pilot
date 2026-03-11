import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import { api } from '@/boot/axios'
import type { User } from './types'

export const useAdminUsersStore = defineStore('adminUsers', () => {
  const listApi = useApi<ApiResponseWrapper<User[]>>(
    () => api.get('/admin/users').then((response) => response.data)
  )

  const toggleActiveApi = useApi<ApiResponseWrapper<User>, { id: number }>(
    ({ id }) => api.patch(`/admin/users/${String(id)}/toggle-active`).then((response) => response.data)
  )

  const updateRoleApi = useApi<ApiResponseWrapper<User>, { id: number; role: string }>(
    ({ id, role }) => api.patch(`/admin/users/${String(id)}/role`, { role }).then((response) => response.data)
  )

  const users = computed(() => listApi.response.value?.data ?? [])

  const fetchUsers = () => listApi.execute()
  const toggleActive = (id: number) => toggleActiveApi.execute({ id })
  const updateRole = (id: number, role: string) => updateRoleApi.execute({ id, role })

  return {
    listApi,
    toggleActiveApi,
    updateRoleApi,
    users,
    fetchUsers,
    toggleActive,
    updateRole
  }
})
