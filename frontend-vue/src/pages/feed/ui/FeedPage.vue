<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import { useAccountStore } from '@/entities/instagram-account/model/accountStore'
  import { useFeedStore, MOCK_FEED } from '@/entities/media-post'
  import type { MediaPost } from '@/entities/media-post'
  import type { InstagramAccount } from '@/entities/instagram-account/model/types'
  import type { Nullable } from '@/shared/lib'
  import { notifyError, notifySuccess, useModal, proxyImageUrl } from '@/shared/lib'
  import { SelectComponent } from '@/shared/ui/select-component'
  import { MasonryGrid } from '@/shared/ui/masonry-grid'
  import { MediaCard } from '@/shared/ui/media-card'
  import { PostDetailModal } from '@/features/post-detail'
  import { InstagramUserModal } from '@/features/instagram-user'

  const accountStore = useAccountStore()
  const feedStore = useFeedStore()

  const selectedAccount = ref<Nullable<InstagramAccount>>(null)
  const selectedPost = ref<Nullable<MediaPost>>(null)
  const postModal = useModal()
  const userModal = useModal()

  const SELECTED_ACCOUNT_KEY = 'feed_selected_account_id'

  const isInitializing = ref(true)
  const isMockMode = computed(() => !isInitializing.value && !selectedAccount.value)
  const displayPosts = computed(() => isMockMode.value ? MOCK_FEED : feedStore.posts)

  watch(selectedAccount, (account) => {
    if (account) {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, String(account.id))
      feedStore.loadFeed(account.id)
        .catch(() => notifyError(feedStore.feedError ?? 'Ошибка загрузки ленты'))
    } else {
      localStorage.removeItem(SELECTED_ACCOUNT_KEY)
    }
  })

  const loadMoreClickHandler = () => {
    if (!selectedAccount.value) return
    feedStore.loadMoreFeed(selectedAccount.value.id)
      .catch(() => notifyError('Ошибка загрузки'))
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

  const openUserHandler = (post: MediaPost) => {
    if (!selectedAccount.value) return
    feedStore.fetchUserInfo(selectedAccount.value.id, post.user.pk)
      .then(() => userModal.open())
      .catch(() => notifyError('Не удалось загрузить профиль'))
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
</script>

<template>
  <q-page class="feed-page q-pa-md">
    <div class="row items-center justify-between q-mb-lg">
      <span class="text-h6">Лента</span>
      <SelectComponent
        v-model="selectedAccount"
        :options="accountStore.accounts"
        :loading="accountStore.fetchAccountsLoading"
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

    <div v-if="isMockMode" class="mock-notice row items-center q-mb-md text-grey-6 text-caption">
      <q-icon name="info_outline" size="16px" class="q-mr-xs" />
      Демо-режим — выберите аккаунт для загрузки реальной ленты
    </div>

    <div v-if="isInitializing || feedStore.feedLoading" class="row justify-center q-pa-xl">
      <q-spinner size="48px" color="primary" />
    </div>

    <div v-else-if="!isMockMode && feedStore.feedError" class="column items-center q-pa-xl text-negative">
      <q-icon name="error_outline" size="48px" />
      <p class="q-mt-sm">{{ feedStore.feedError }}</p>
    </div>

    <div v-else>
      <MasonryGrid>
        <MediaCard
          v-for="post in displayPosts"
          :key="post.pk"
          :post="post"
          :is-mock="isMockMode"
          :is-liking="feedStore.isLiking"
          @open="openPostHandler"
          @like="likePostHandler"
          @open-user="openUserHandler"
        />
      </MasonryGrid>

      <div
        v-if="!isMockMode && !feedStore.feedLoading && displayPosts.length === 0"
        class="column items-center q-pa-xl text-grey"
      >
        <q-icon name="photo_library" size="64px" color="grey-3" />
        <p class="q-mt-sm">Лента пуста</p>
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
      @like="likePostHandler"
      @open-user="openUserHandler"
    />

    <InstagramUserModal
      v-model="userModal.isVisible"
      :user="feedStore.userDetail"
      :loading="feedStore.userInfoLoading"
    />
  </q-page>
</template>

<style scoped lang="scss">
  .feed-page {
    max-width: 1200px;
    margin: 0 auto;
  }

  .mock-notice {
    padding: 8px 12px;
    background: #f5f5f5;
    border-radius: 6px;
  }
</style>
