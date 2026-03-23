import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import { api } from '@/boot/axios'
import type { UserApi } from '@/entities/user/model/apiTypes'
import type { User } from '@/entities/user/model/types'
import userDTO from '@/entities/user/model/userDTO'

export const useAdminUsersStore = defineStore('adminUsers', () => {
  const listApi = useApi<ApiResponseWrapper<UserApi[]>>(
    () => api.get('/admin/users').then((response) => response.data)
  )

  const toggleActiveApi = useApi<ApiResponseWrapper<UserApi>, { id: number }>(
    ({ id }) => api.patch(`/admin/users/${String(id)}/toggle-active`).then((response) => response.data)
  )

  const updateRoleApi = useApi<ApiResponseWrapper<UserApi>, { id: number; role: string }>(
    ({ id, role }) => api.patch(`/admin/users/${String(id)}/role`, { role }).then((response) => response.data)
  )

  const users = ref<User[]>([])

  const fetchUsers = async () => {
    const { data } = await listApi.execute()
    users.value = userDTO.toLocalList(data)
  }
  const fetchUsersLoading = computed(() => listApi.loading.value)

  const toggleActive = (id: number) => toggleActiveApi.execute({ id })
  const toggleActiveError = computed(() => toggleActiveApi.error.value)

  const updateRole = (id: number, role: string) => updateRoleApi.execute({ id, role })
  const updateRoleError = computed(() => updateRoleApi.error.value)

  return {
    users,
    fetchUsers,
    fetchUsersLoading,
    toggleActive,
    toggleActiveError,
    updateRole,
    updateRoleError
  }
})
