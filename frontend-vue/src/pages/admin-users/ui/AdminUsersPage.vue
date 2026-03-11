<script setup lang="ts">
  import { onMounted } from 'vue'
  import { Notify } from 'quasar'
  import { useAdminUsersStore } from '@/entities/user'
  import type { User } from '@/entities/user'

  const store = useAdminUsersStore()

  const columns = [
    { name: 'name', label: 'Имя', field: 'name', align: 'left' as const, sortable: true },
    { name: 'email', label: 'Email', field: 'email', align: 'left' as const, sortable: true },
    { name: 'role', label: 'Роль', field: 'roles', align: 'center' as const },
    { name: 'is_active', label: 'Активен', field: 'is_active', align: 'center' as const }
  ]

  const roleOptions = [
    { label: 'Пользователь', value: 'user' },
    { label: 'Администратор', value: 'admin' }
  ]

  const getRole = (user: User) => user.roles[0]?.name ?? 'user'

  const toggleActiveHandler = async (user: User) => {
    await store.toggleActive(user.id)
      .then(() => {
        const updated = store.toggleActiveApi.data.value?.data
        if (updated && store.listApi.data.value?.data) {
          const idx = store.listApi.data.value.data.findIndex((u) => u.id === updated.id)
          if (idx !== -1) store.listApi.data.value.data.splice(idx, 1, updated)
        }
      })
      .catch(() => Notify.create({ type: 'negative', message: store.toggleActiveApi.error ?? 'Ошибка' }))
  }

  const updateRoleHandler = async (user: User, role: string) => {
    await store.updateRole(user.id, role)
      .then(() => {
        const updated = store.updateRoleApi.data.value?.data
        if (updated && store.listApi.data.value?.data) {
          const idx = store.listApi.data.value.data.findIndex((u) => u.id === updated.id)
          if (idx !== -1) store.listApi.data.value.data.splice(idx, 1, updated)
        }
      })
      .catch(() => Notify.create({ type: 'negative', message: store.updateRoleApi.error ?? 'Ошибка' }))
  }

  onMounted(() => store.fetchUsers())
</script>

<template>
  <q-page padding>
    <div class="text-h5 q-mb-md">Пользователи</div>

    <q-table
      :rows="store.listApi.data?.data ?? []"
      :columns="columns"
      :loading="store.listApi.loading"
      row-key="id"
      flat
      bordered
    >
      <template #body-cell-role="{ row }">
        <q-td class="text-center">
          <q-select
            :model-value="getRole(row)"
            :options="roleOptions"
            option-value="value"
            option-label="label"
            emit-value
            map-options
            dense
            borderless
            style="min-width: 140px"
            @update:model-value="(role) => updateRoleHandler(row, role)"
          />
        </q-td>
      </template>

      <template #body-cell-is_active="{ row }">
        <q-td class="text-center">
          <q-toggle
            :model-value="row.is_active"
            @update:model-value="() => toggleActiveHandler(row)"
          />
        </q-td>
      </template>
    </q-table>
  </q-page>
</template>
