<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useAccountStore } from '@/entities/instagram-account/model/accountStore'
  import { useFeedStore } from '@/entities/media-post'
  import instagramAccountTableColumns from '@/entities/instagram-account/model/instagramAccountTableColumns'
  import instagramAccountListDTO from '@/entities/instagram-account/model/instagramAccountListDTO'
  import type { InstagramAccount } from '@/entities/instagram-account/model/types'
  import type { Nullable } from '@/shared/lib'
  import { useFilterColumns, useSearchQuery, useModal, notifyError } from '@/shared/lib'
  import { PageComponent } from '@/shared/ui/page-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { TableComponent } from '@/shared/ui/table-component'
  import { TableToolsWrapper } from '@/shared/ui/table-tools-wrapper'
  import { BadgeComponent } from '@/shared/ui/badge-component'
  import { AddInstagramAccountModal } from '@/features/add-instagram-account'
  import { DeleteInstagramAccountModal } from '@/features/delete-instagram-account'
  import { InstagramUserModal } from '@/features/instagram-user'

  const store = useAccountStore()
  const feedStore = useFeedStore()

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

  const openViewHandler = async (id: number) => {
    selectedAccount.value = findAccount(id)
    viewModal.open()
    try {
      await store.fetchAccountDetails(id)
      const userPk = store.accountDetail?.userPk
      userPk && await feedStore.fetchUserInfo(id, String(userPk))
    } catch {
      notifyError('Не удалось загрузить профиль')
    }
  }

  const openDeleteHandler = (id: number) => {
    selectedAccount.value = findAccount(id)
    deleteModal.open()
  }

  onMounted(() => store.fetchAccounts())
</script>

<template>
  <PageComponent :title="pageTitle" icon="manage_accounts">
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
            <BadgeComponent
              :color="(value as boolean) ? 'positive' : 'grey-5'"
              :label="(value as boolean) ? 'Активен' : 'Неактивен'"
              size="md"
            />
          </q-td>
        </template>

        <template #body-cell-actions="{ value, row }">
          <q-td class="text-center">
            <ButtonComponent
              flat
              round
              dense
              icon-scale="lg"
              icon="visibility"
              :disable="!row.isActive"
              @click="openViewHandler(value as number)"
            />
            <ButtonComponent
              flat
              round
              dense
              icon-scale="lg"
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

    <InstagramUserModal
      v-model="viewModal.isVisible"
      :user="feedStore.userDetail"
      :loading="store.fetchAccountDetailsLoading || feedStore.userInfoLoading"
    />
  </PageComponent>
</template>
