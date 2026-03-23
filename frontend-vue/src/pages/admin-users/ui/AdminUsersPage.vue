<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useAdminUsersStore, useAuthStore } from '@/entities/user'
  import adminUsersTableColumns from '@/entities/user/model/adminUsersTableColumns'
  import adminUsersListDTO from '@/entities/user/model/adminUsersListDTO'
  import { useFilterColumns, useSearchQuery, notifyError } from '@/shared/lib'
  import { PageComponent } from '@/shared/ui/page-component'
  import { TableComponent } from '@/shared/ui/table-component'
  import { TableToolsWrapper } from '@/shared/ui/table-tools-wrapper'
  import { SelectComponent } from '@/shared/ui/select-component'
  import { ToggleComponent } from '@/shared/ui/toggle-component'

  const store = useAdminUsersStore()
  const authStore = useAuthStore()

  const isSelf = (id: number) => authStore.user?.id === id

  const { columns, columnsVisibleNames } = useFilterColumns(adminUsersTableColumns)
  const { searchText } = useSearchQuery()

  const rows = computed(() => adminUsersListDTO.toLocal(store.users))

  const roleOptions = [
    { label: 'Пользователь', value: 'user' },
    { label: 'Администратор', value: 'admin' }
  ]

  const processingIds = ref(new Set<number>())

  const toggleActiveHandler = async (id: number) => {
    if (processingIds.value.has(id)) return
    processingIds.value.add(id)
    await store.toggleActive(id)
      .then(() => store.fetchUsers())
      .catch(() => notifyError(store.toggleActiveError ?? 'Ошибка'))
      .finally(() => processingIds.value.delete(id))
  }

  const updateRoleHandler = async (id: number, role: string) => {
    const current = store.users.find((user) => user.id === id)
    if (current?.roles[0]?.name === role) return
    if (processingIds.value.has(id)) return
    processingIds.value.add(id)
    await store.updateRole(id, role)
      .then(() => store.fetchUsers())
      .catch(() => notifyError(store.updateRoleError ?? 'Ошибка'))
      .finally(() => processingIds.value.delete(id))
  }

  onMounted(() => store.fetchUsers())
</script>

<template>
  <PageComponent title="Пользователи" icon="people">
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
              :disable="isSelf(row.id)"
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
              :disable="isSelf(row.id)"
              @update:model-value="() => toggleActiveHandler(row.id)"
            />
          </q-td>
        </template>
      </TableComponent>
    </TableToolsWrapper>
  </PageComponent>
</template>
