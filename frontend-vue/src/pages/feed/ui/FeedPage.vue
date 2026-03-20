<script setup lang="ts">
  import { ref, computed, watch, nextTick, onMounted } from 'vue'
  import { onBeforeRouteLeave } from 'vue-router'
  import { useAccountStore } from '@/entities/instagram-account/model/accountStore'
  import { useFeedStore, MOCK_FEED } from '@/entities/media-post'
  import type { MediaPost } from '@/entities/media-post'
  import type { InstagramAccount } from '@/entities/instagram-account/model/types'
  import type { Nullable } from '@/shared/lib'
  import { notifyError, notifySuccess, useModal, proxyImageUrl } from '@/shared/lib'
  import { isCancelledRequest } from '@/shared/api'
  import { PageComponent } from '@/shared/ui/page-component'
  import { SelectComponent } from '@/shared/ui/select-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { ToggleComponent } from '@/shared/ui/toggle-component'
  import { MasonryGrid } from '@/shared/ui/masonry-grid'
  import { MediaCard } from '@/shared/ui/media-card'
  import { PostDetailModal } from '@/features/post-detail'
  import { InstagramUserModal } from '@/features/instagram-user'

  const accountStore = useAccountStore()
  const feedStore = useFeedStore()

  const SELECTED_ACCOUNT_KEY = 'feed_selected_account_id'

  const selectedAccount = ref<Nullable<InstagramAccount>>(null)
  const accountSelectRef = ref<InstanceType<typeof SelectComponent>>()
  const accountStackLabel = computed(() => !!selectedAccount.value || !!localStorage.getItem(SELECTED_ACCOUNT_KEY))
  const selectedPost = ref<Nullable<MediaPost>>(null)
  const loadingUserPk = ref<Nullable<string>>(null)
  const postModal = useModal()
  const userModal = useModal()

  const isInitializing = ref(true)
  const isMockMode = computed(() => !isInitializing.value && !selectedAccount.value)
  const displayPosts = computed(() => isMockMode.value ? MOCK_FEED : feedStore.posts)

  watch(selectedAccount, (account) => {
    if (account) {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, String(account.id))
      feedStore.loadFeed(account.id)
        .catch((error: unknown) => isCancelledRequest(error) || notifyError(feedStore.feedError ?? 'Ошибка загрузки ленты'))
    } else {
      localStorage.removeItem(SELECTED_ACCOUNT_KEY)
      void nextTick(() => accountSelectRef.value?.blur())
    }
  })

  const refreshFeedHandler = () => {
    if (!selectedAccount.value) return
    feedStore.refreshFeed(selectedAccount.value.id)
      .catch((error: unknown) => isCancelledRequest(error) || notifyError('Ошибка обновления ленты'))
  }

  const cacheToggleHandler = (enabled: boolean) => {
    selectedAccount.value && feedStore.setCacheEnabled(selectedAccount.value.id, enabled)
  }

  const minPostsOptions = [
    { label: 'По умолчанию', value: null },
    { label: '5 постов', value: 5 },
    { label: '10 постов', value: 10 },
    { label: '15 постов', value: 15 }
  ]

  const loadMoreClickHandler = () => {
    if (!selectedAccount.value) return
    feedStore.loadMoreFeed(selectedAccount.value.id)
      .catch((error: unknown) => isCancelledRequest(error) || notifyError('Ошибка загрузки'))
  }

  const openPostHandler = (post: MediaPost) => {
    selectedPost.value = post
    postModal.open()
  }

  const likePostHandler = (post: MediaPost) => {
    if (!selectedAccount.value) return
    feedStore.likePost(selectedAccount.value.id, post)
      .then(() => notifySuccess('Лайк поставлен'))
      .catch(() => notifyError('Ошибка лайка'))
  }


  const getPostHeight = (post: MediaPost, columnWidth: number): number | undefined => {
    if (post.thumbnailWidth && post.thumbnailHeight) {
      return (post.thumbnailHeight / post.thumbnailWidth) * columnWidth
    }
  }

  const openUserHandler = (post: MediaPost) => {
    if (!selectedAccount.value || loadingUserPk.value) return
    
    loadingUserPk.value = post.user.pk
    feedStore.fetchUserInfo(selectedAccount.value.id, post.user.pk)
      .then(() => userModal.open())
      .catch(() => notifyError('Не удалось загрузить профиль'))
      .finally(() => { loadingUserPk.value = null })
  }

  onMounted(() => {
    void accountStore.fetchAccounts().then(() => {
      const savedId = localStorage.getItem(SELECTED_ACCOUNT_KEY)
      if (savedId) {
        const account = accountStore.accounts.find((account) => String(account.id) === savedId)
        account && (selectedAccount.value = account)
      }
      isInitializing.value = false
    })
  })

  onBeforeRouteLeave(() => {
    feedStore.cancelFeedLoad()
    feedStore.cancelLoadMore()
    feedStore.cancelUserInfo()
  })
</script>

<template>
  <PageComponent title="Лента" icon="photo_library" class="feed-page">
    <template #append>
      <div class="row items-center q-gutter-sm">
        <ButtonComponent
          icon="refresh"
          flat
          round
          color="primary"
          :disable="!selectedAccount || feedStore.feedLoading"
          @click="refreshFeedHandler"
        />
        <ToggleComponent
          :model-value="feedStore.cacheEnabled"
          label="Кэш"
          dense
          :disable="!selectedAccount"
          @update:model-value="cacheToggleHandler"
        />
        <SelectComponent
          :model-value="feedStore.minPostsPerLoad"
          :options="minPostsOptions"
          option-label="label"
          option-value="value"
          label="Постов"
          dense
          outlined
          emit-value
          map-options
          :disable="!selectedAccount"
          style="min-width: 150px"
          @update:model-value="(value: number | null) => feedStore.setMinPostsPerLoad(value)"
        />
        <SelectComponent
          ref="accountSelectRef"
          v-model="selectedAccount"
          :options="accountStore.accounts"
          :loading="accountStore.fetchAccountsLoading"
          :stack-label="accountStackLabel"
          option-label="instagram_login"
          label="Выберите аккаунт"
          clearable
          outlined
          dense
          style="min-width: 260px"
          emit-value
          map-options
        >
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section avatar>
                <q-avatar size="32px">
                  <img v-if="scope.opt.profile_pic_url" :src="proxyImageUrl(scope.opt.profile_pic_url) ?? undefined">
                  <q-icon v-else name="person" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ scope.opt.instagram_login }}</q-item-label>
                <q-item-label v-if="scope.opt.full_name" caption>{{ scope.opt.full_name }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </SelectComponent>
      </div>
    </template>

    <div v-if="isMockMode" class="mock-notice row items-center q-mb-md text-grey-6 text-caption">
      <q-icon name="info_outline" size="16px" class="q-mr-xs" />
      Демо-режим — выберите аккаунт для загрузки реальной ленты
    </div>

    <div v-if="isInitializing || feedStore.feedLoading" class="empty-state">
      <q-spinner size="48px" color="primary" />
    </div>

    <div v-else-if="!isMockMode && feedStore.feedError" class="empty-state text-negative">
      <q-icon name="error_outline" size="96px" />
      <p class="empty-state__text text-negative">{{ feedStore.feedError }}</p>
    </div>

    <div v-else>
      <MasonryGrid :items="displayPosts" :get-item-height="getPostHeight">
        <template #default="{ item }">
          <MediaCard
            :key="item.pk"
            :post="item"
            :is-mock="isMockMode"
            :is-liking="feedStore.isLiking"
            :loading-user-pk="loadingUserPk"
            @open="openPostHandler"
            @like="likePostHandler"
            @open-user="openUserHandler"
          />
        </template>
      </MasonryGrid>

      <div
        v-if="!isMockMode && !feedStore.feedLoading && displayPosts.length === 0"
        class="empty-state"
      >
        <q-icon name="photo_library" size="96px" color="grey-3" />
        <p class="empty-state__text">Лента пуста</p>
      </div>

      <div v-if="!isMockMode && feedStore.moreAvailable" class="row justify-center q-pa-md">
        <q-btn
          label="Загрузить ещё"
          color="primary"
          outline
          :loading="feedStore.loadMoreLoading"
          @click="loadMoreClickHandler"
        />
      </div>
    </div>

    <PostDetailModal
      v-if="selectedPost"
      v-model="postModal.isVisible"
      :post="selectedPost"
      :is-liking="feedStore.isLiking"
      :loading-user-pk="loadingUserPk"
      @like="likePostHandler"
      @open-user="openUserHandler"
    />

    <InstagramUserModal
      v-model="userModal.isVisible"
      :user="feedStore.userDetail"
      :loading="feedStore.userInfoLoading"
    />
  </PageComponent>
</template>

<style scoped lang="scss">
  .mock-notice {
    padding: $spacing-inline-gap $spacing-stack-gap;
    background: $surface-tertiary;
    border-radius: $radius-md;
  }
</style>
