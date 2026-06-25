<script setup lang="ts">
  import { ref, watch, onMounted } from 'vue'
  import { onBeforeRouteLeave } from 'vue-router'
  import { useAccountSelect, AccountSelectComponent } from '@/entities/instagram-account'
  import { useShowcaseStore } from '@/entities/showcase-media'
  import type { ShowcaseMedia } from '@/entities/showcase-media'
  import type { Nullable } from '@/shared/lib'
  import { notifyError, useModal } from '@/shared/lib'
  import { isCancelledRequest } from '@/shared/api'
  import { PageComponent } from '@/shared/ui/page-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { EmptyStateComponent } from '@/shared/ui/empty-state-component'
  import { PhoneFrame } from '@/widgets/phone-frame'
  import { ShowcaseGrid } from '@/widgets/showcase-grid'
  import { PostDetailModal } from '@/features/post-detail'

  const showcaseStore = useShowcaseStore()
  const { selectedAccount, accountSelectRef, accountStackLabel, isInitializing, initAccounts } = useAccountSelect('showcase_selected_account_id')

  const selectedMedia = ref<Nullable<ShowcaseMedia>>(null)
  const postModal = useModal()

  watch(selectedAccount, (account) => {
    if (!account) return
    showcaseStore.fetchProfile(account.id)
      .catch((error: unknown) => isCancelledRequest(error) || notifyError(showcaseStore.profileError ?? 'Ошибка загрузки профиля'))
    showcaseStore.fetchMedias(account.id)
      .catch((error: unknown) => isCancelledRequest(error) || notifyError(showcaseStore.mediasError ?? 'Ошибка загрузки постов'))
  })

  const openPostHandler = (media: ShowcaseMedia) => {
    selectedMedia.value = media
    postModal.open()
  }

  const loadMoreClickHandler = () => {
    if (!selectedAccount.value) return
    showcaseStore.loadMore(selectedAccount.value.id)
      .catch((error: unknown) => isCancelledRequest(error) || notifyError('Ошибка загрузки'))
  }

  onMounted(() => void initAccounts())

  onBeforeRouteLeave(() => {
    showcaseStore.cancelProfile()
    showcaseStore.cancelMedias()
    showcaseStore.cancelLoadMore()
  })
</script>

<template>
  <PageComponent title="Витрина" icon="storefront" class="showcase-page">
    <template #append>
      <AccountSelectComponent
        ref="accountSelectRef"
        v-model="selectedAccount"
        :stack-label="accountStackLabel"
      />
    </template>

    <div v-if="!selectedAccount && !isInitializing" class="text-grey-6 text-center q-pa-xl">
      <q-icon name="storefront" size="48px" class="q-mb-sm" />
      <div>Выберите аккаунт для просмотра витрины</div>
    </div>

    <div v-else-if="isInitializing || showcaseStore.profileLoading || showcaseStore.mediasLoading" class="loading-center">
      <q-spinner size="48px" color="primary" />
    </div>

    <EmptyStateComponent
      v-else-if="showcaseStore.profileError || showcaseStore.mediasError"
      icon="error_outline"
      :text="showcaseStore.profileError ?? showcaseStore.mediasError ?? ''"
      class="text-negative"
    />

    <div v-else>
      <PhoneFrame :profile="showcaseStore.profile">
        <ShowcaseGrid :posts="showcaseStore.posts" @open="openPostHandler" />

        <EmptyStateComponent
          v-if="showcaseStore.posts.length === 0"
          icon="grid_off"
          text="Постов нет"
        />
      </PhoneFrame>

      <div v-if="showcaseStore.moreAvailable" class="row justify-center q-pa-md">
        <ButtonComponent
          label="Загрузить ещё"
          color="primary"
          outline
          :loading="showcaseStore.loadMoreLoading"
          @click="loadMoreClickHandler"
        />
      </div>
    </div>

    <PostDetailModal
      v-if="selectedMedia"
      v-model="postModal.isVisible"
      :post="selectedMedia.post"
      v-bind="selectedAccount ? { accountId: selectedAccount.id } : {}"
    />
  </PageComponent>
</template>

<style scoped lang="scss">
  .loading-center {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: calc(100vh - 270px);
  }
</style>
