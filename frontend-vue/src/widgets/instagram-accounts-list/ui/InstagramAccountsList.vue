<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useAccountStore } from '@/entities/instagram-account/model/accountStore'
  import instagramAccountTableColumns from '@/entities/instagram-account/model/instagramAccountTableColumns'
  import instagramAccountListDTO from '@/entities/instagram-account/model/instagramAccountListDTO'
  import type { InstagramAccount } from '@/entities/instagram-account/model/types'
  import type { Nullable } from '@/shared/lib'
  import { useFilterColumns, useSearchQuery, useModal } from '@/shared/lib'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { TableComponent } from '@/shared/ui/table-component'
  import { TableToolsWrapper } from '@/shared/ui/table-tools-wrapper'
  import { AddInstagramAccountModal } from '@/features/add-instagram-account'
  import { DeleteInstagramAccountModal } from '@/features/delete-instagram-account'
  import { ViewInstagramAccountModal } from '@/features/view-instagram-account'

  const store = useAccountStore()

  const addModal = useModal()
  const deleteModal = useModal()
  const viewModal = useModal()
  const selectedAccount = ref<Nullable<InstagramAccount>>(null)
  const showActiveOnly = ref(false)

  const { columns, columnsVisibleNames } = useFilterColumns(instagramAccountTableColumns)
  const { searchText } = useSearchQuery()

  const allRows = computed(() => instagramAccountListDTO.toLocal(store.accounts))

  const rows = computed(() =>
    showActiveOnly.value
      ? allRows.value.filter((row) => row.isActive)
      : allRows.value
  )

  const pageTitle = computed(() => `Аккаунты Instagram (${String(allRows.value.length)})`)

  const findAccount = (id: number): Nullable<InstagramAccount> =>
    store.accounts.find((account) => account.id === id) ?? null

  const openViewHandler = (id: number) => {
    selectedAccount.value = findAccount(id)
    viewModal.open()
  }

  const openDeleteHandler = (id: number) => {
    selectedAccount.value = findAccount(id)
    deleteModal.open()
  }

  onMounted(() => store.fetchAccounts())
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
        @click="addModal.open()"
      />
    </template>

    <TableComponent
      :rows="rows"
      :columns="columns"
      :visible-columns="columnsVisibleNames"
      :filter="searchText"
      :loading="store.fetchAccountsLoading"
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
    v-model="addModal.isVisible"
    @added="() => store.fetchAccounts()"
  />

  <DeleteInstagramAccountModal
    v-if="selectedAccount"
    v-model="deleteModal.isVisible"
    :account="selectedAccount"
    @deleted="() => store.fetchAccounts()"
  />

  <ViewInstagramAccountModal
    v-if="selectedAccount"
    v-model="viewModal.isVisible"
    :account-id="selectedAccount.id"
  />
</template>
