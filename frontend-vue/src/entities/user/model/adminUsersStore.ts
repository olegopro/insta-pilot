import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { apiData, useApi, type ApiResponseWrapper } from '@/shared/api'
import { api } from '@/boot/axios'
import type { UserApi } from '@/entities/user/model/apiTypes'
import type { User } from '@/entities/user/model/types'
import userDTO from '@/entities/user/model/userDTO'

export const useAdminUsersStore = defineStore('adminUsers', () => {
  const listApi = useApi<ApiResponseWrapper<UserApi[]>>(
    () => apiData(api.get('/admin/users'))
  )

  const toggleActiveApi = useApi<ApiResponseWrapper<UserApi>, { id: number }>(
    ({ id }) => apiData(api.patch(`/admin/users/${String(id)}/toggle-active`))
  )

  const updateRoleApi = useApi<ApiResponseWrapper<UserApi>, { id: number; role: string }>(
    ({ id, role }) => apiData(api.patch(`/admin/users/${String(id)}/role`, { role }))
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
