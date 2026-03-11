<script setup lang="ts">
  import { computed, onMounted } from 'vue'
  import { useAdminUsersStore } from '@/entities/user'
  import adminUsersTableColumns from '@/entities/user/model/adminUsersTableColumns'
  import adminUsersListDTO from '@/entities/user/model/adminUsersListDTO'
  import { useFilterColumns, useSearchQuery, notifyError } from '@/shared/lib'
  import { TableComponent } from '@/shared/ui/table-component'
  import { TableToolsWrapper } from '@/shared/ui/table-tools-wrapper'
  import { SelectComponent } from '@/shared/ui/select-component'
  import { ToggleComponent } from '@/shared/ui/toggle-component'

  const store = useAdminUsersStore()

  const { columns, columnsVisibleNames } = useFilterColumns(adminUsersTableColumns)
  const { searchText } = useSearchQuery()

  const rows = computed(() => adminUsersListDTO.toLocal(store.users))

  const roleOptions = [
    { label: 'Пользователь', value: 'user' },
    { label: 'Администратор', value: 'admin' }
  ]

  const toggleActiveHandler = async (id: number) => {
    await store.toggleActive(id)
      .then(() => store.fetchUsers())
      .catch(() => notifyError(store.toggleActiveError ?? 'Ошибка'))
  }

  const updateRoleHandler = async (id: number, role: string) => {
    await store.updateRole(id, role)
      .then(() => store.fetchUsers())
      .catch(() => notifyError(store.updateRoleError ?? 'Ошибка'))
  }

  onMounted(() => store.fetchUsers())
</script>

<template>
  <q-page padding>
    <div class="text-h5 q-mb-md">Пользователи</div>

    <TableToolsWrapper
      v-model:search="searchText"
      v-model:columns="columns"
      v-model:columns-visible-names="columnsVisibleNames"
      search-placeholder="Поиск по пользователям"
    >
      <TableComponent
        :rows="rows"
        :columns="columns"
        :visible-columns="columnsVisibleNames"
        :filter="searchText"
        :loading="store.fetchUsersLoading"
        row-key="id"
        no-data-label="Нет пользователей"
      >
        <template #body-cell-role="{ row, value }">
          <q-td class="text-center">
            <SelectComponent
              :model-value="value"
              :options="roleOptions"
              option-value="value"
              option-label="label"
              emit-value
              map-options
              dense
              borderless
              @update:model-value="(role) => updateRoleHandler(row.id, role)"
            />
          </q-td>
        </template>

        <template #body-cell-isActive="{ row, value }">
          <q-td class="text-center">
            <ToggleComponent
              :model-value="value"
              @update:model-value="() => toggleActiveHandler(row.id)"
            />
          </q-td>
        </template>
      </TableComponent>
    </TableToolsWrapper>
  </q-page>
</template>
