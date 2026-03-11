<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useAccountStore } from 'src/entities/instagram-account/model/accountStore'
  import instagramAccountTableColumns from 'src/entities/instagram-account/model/instagramAccountTableColumns'
  import instagramAccountListDTO from 'src/entities/instagram-account/model/instagramAccountListDTO'
  import type { InstagramAccount } from 'src/entities/instagram-account/model/types'
  import type { Nullable } from 'src/shared/lib'
  import { useFilterColumns, useSearchQuery } from 'src/shared/lib'
  import { ButtonComponent } from 'src/shared/ui/button-component'
  import { TableComponent } from 'src/shared/ui/table-component'
  import { TableToolsWrapper } from 'src/shared/ui/table-tools-wrapper'
  import { AddInstagramAccountModal } from 'src/features/add-instagram-account'
  import { DeleteInstagramAccountModal } from 'src/features/delete-instagram-account'
  import { ViewInstagramAccountModal } from 'src/features/view-instagram-account'

  const store = useAccountStore()

  const showAddModal = ref(false)
  const showDeleteModal = ref(false)
  const showViewModal = ref(false)
  const selectedAccount = ref<Nullable<InstagramAccount>>(null)
  const showActiveOnly = ref(false)

  const { columns, columnsVisibleNames } = useFilterColumns(instagramAccountTableColumns)
  const { searchText } = useSearchQuery()

  const allRows = computed(() =>
    instagramAccountListDTO.toLocal(store.fetchAccounts.data?.data ?? [])
  )

  const rows = computed(() =>
    showActiveOnly.value
      ? allRows.value.filter((row) => row.isActive)
      : allRows.value
  )

  const pageTitle = computed(() => `Аккаунты Instagram (${String(allRows.value.length)})`)

  const findAccount = (id: number): Nullable<InstagramAccount> =>
    store.fetchAccounts.data?.data.find((a) => a.id === id) ?? null

  const openViewHandler = (id: number) => {
    selectedAccount.value = findAccount(id)
    showViewModal.value = true
  }

  const openDeleteHandler = (id: number) => {
    selectedAccount.value = findAccount(id)
    showDeleteModal.value = true
  }

  onMounted(() => store.fetchAccounts.execute())
</script>

<template>
  <div class="row items-center q-mb-md">
    <span class="text-h6">{{ pageTitle }}</span>
  </div>

  <TableToolsWrapper
    v-model:search="searchText"
    v-model:columns="columns"
    v-model:columns-visible-names="columnsVisibleNames"
    search-placeholder="Поиск по аккаунтам"
  >
    <template #tools>
      <q-toggle v-model="showActiveOnly" label="Активные" dense />
      <ButtonComponent
        color="primary"
        icon="add"
        label="Добавить"
        @click="showAddModal = true"
      />
    </template>

    <TableComponent
      :rows="rows"
      :columns="columns"
      :visible-columns="columnsVisibleNames"
      :filter="searchText"
      :loading="store.fetchAccounts.loading"
      row-key="id"
      no-data-label="Нет аккаунтов"
    >
      <template #body-cell-isActive="{ value }">
        <q-td class="text-center">
          <q-badge
            :color="(value as boolean) ? 'positive' : 'grey-5'"
            :label="(value as boolean) ? 'Активен' : 'Неактивен'"
          />
        </q-td>
      </template>

      <template #body-cell-actions="{ value }">
        <q-td class="text-center">
          <ButtonComponent
            flat
            round
            dense
            icon="visibility"
            @click="openViewHandler(value as number)"
          />
          <ButtonComponent
            flat
            round
            dense
            icon="delete"
            color="negative"
            @click="openDeleteHandler(value as number)"
          />
        </q-td>
      </template>
    </TableComponent>
  </TableToolsWrapper>

  <AddInstagramAccountModal
    v-model="showAddModal"
    @added="() => store.fetchAccounts.execute()"
  />

  <DeleteInstagramAccountModal
    v-if="selectedAccount"
    v-model="showDeleteModal"
    :account="selectedAccount"
    @deleted="() => store.fetchAccounts.execute()"
  />

  <ViewInstagramAccountModal
    v-if="selectedAccount"
    v-model="showViewModal"
    :account-id="selectedAccount.id"
  />
</template>
