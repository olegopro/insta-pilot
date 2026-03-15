<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import { useAccountStore } from '@/entities/instagram-account/model/accountStore'
  import { useSearchStore, useFeedStore } from '@/entities/media-post'
  import type { MediaPost, Location } from '@/entities/media-post'
  import type { InstagramAccount } from '@/entities/instagram-account/model/types'
  import type { Nullable } from '@/shared/lib'
  import { notifyError, notifySuccess, useModal, proxyImageUrl } from '@/shared/lib'
  import { SelectComponent } from '@/shared/ui/select-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { InputComponent } from '@/shared/ui/input-component'
  import { MasonryGrid } from '@/shared/ui/masonry-grid'
  import { MediaCard } from '@/shared/ui/media-card'
  import { PostDetailModal } from '@/features/post-detail'
  import { InstagramUserModal } from '@/features/instagram-user'

  type SearchMode = 'hashtag' | 'location'

  const SELECTED_ACCOUNT_KEY = 'search_selected_account_id'

  const accountStore = useAccountStore()
  const searchStore = useSearchStore()
  const feedStore = useFeedStore()

  const selectedAccount = ref<Nullable<InstagramAccount>>(null)
  const selectedPost = ref<Nullable<MediaPost>>(null)
  const searchMode = ref<SearchMode>('hashtag')
  const hashtagInput = ref('')
  const selectedLocation = ref<Nullable<Location>>(null)
  const isInitializing = ref(true)
  const loadingUserPk = ref<Nullable<string>>(null)

  const postModal = useModal()
  const userModal = useModal()

  const searchModeOptions = [
    { label: 'Хэштег', value: 'hashtag' as SearchMode },
    { label: 'Геолокация', value: 'location' as SearchMode }
  ]

  const canSearch = computed(() => !!selectedAccount.value)

  watch(selectedAccount, (account) => {
    if (account) {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, String(account.id))
    } else {
      localStorage.removeItem(SELECTED_ACCOUNT_KEY)
    }
  })

  const getPostHeight = (post: MediaPost, columnWidth: number): number | undefined => {
    if (post.thumbnailWidth && post.thumbnailHeight) {
      return (post.thumbnailHeight / post.thumbnailWidth) * columnWidth
    }
    return undefined
  }

  const resetSearch = () => {
    selectedLocation.value = null
    hashtagInput.value = ''
    searchStore.clearResults()
    searchStore.clearLocations()
  }

  const switchModeHandler = (mode: SearchMode) => {
    searchMode.value = mode
    resetSearch()
  }

  const searchHashtagHandler = () => {
    if (!selectedAccount.value || !hashtagInput.value.trim()) return
    const tag = hashtagInput.value.trim().replace(/^#/, '')
    searchStore.searchHashtag(selectedAccount.value.id, tag)
      .catch(() => notifyError('Ошибка поиска по хэштегу'))
  }

  const loadMoreHandler = () => {
    if (!selectedAccount.value) return
    if (searchMode.value === 'hashtag') {
      const tag = hashtagInput.value.trim().replace(/^#/, '')
      searchStore.loadMoreHashtag(selectedAccount.value.id, tag)
        .catch(() => notifyError('Ошибка загрузки'))
    } else if (selectedLocation.value) {
      searchStore.loadMoreLocationMedias(selectedAccount.value.id, selectedLocation.value.pk)
        .catch(() => notifyError('Ошибка загрузки'))
    }
  }

  const locationFilterHandler = (inputVal: string, update: (fn: () => void) => void) => {
    if (!selectedAccount.value || inputVal.length < 2) {
      update(searchStore.clearLocations)
      return
    }
    searchStore.fetchLocations(selectedAccount.value.id, inputVal)
      .then(() => update(() => undefined))
      .catch(() => update(() => undefined))
  }

  const selectLocationHandler = (location: Location) => {
    if (!selectedAccount.value) return
    selectedLocation.value = location
    searchStore.fetchLocationMedias(selectedAccount.value.id, location.pk)
      .catch(() => notifyError('Ошибка загрузки медиа локации'))
  }

  const likePostHandler = (post: MediaPost) => {
    if (!selectedAccount.value) return
    feedStore.likePost(selectedAccount.value.id, post)
      .then(() => notifySuccess('Лайк поставлен'))
      .catch(() => notifyError('Ошибка лайка'))
  }

  const openUserHandler = (post: MediaPost) => {
    if (!selectedAccount.value || loadingUserPk.value) return
    loadingUserPk.value = post.user.pk
    feedStore.fetchUserInfo(selectedAccount.value.id, post.user.pk)
      .then(() => userModal.open())
      .catch(() => notifyError('Не удалось загрузить профиль'))
      .finally(() => { loadingUserPk.value = null })
  }

  const openPostHandler = (post: MediaPost) => {
    selectedPost.value = post
    postModal.open()
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
  <q-page class="search-page q-pa-md">
    <div class="row items-center justify-between q-mb-lg">
      <span class="text-h6">Поиск</span>
      <SelectComponent
        v-model="selectedAccount"
        :options="accountStore.accounts"
        :loading="accountStore.fetchAccountsLoading || isInitializing"
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

    <div class="controls q-mb-md">
      <q-btn-toggle
        :model-value="searchMode"
        :options="searchModeOptions"
        toggle-color="primary"
        unelevated
        dense
        @update:model-value="switchModeHandler"
      />

      <div v-if="searchMode === 'hashtag'" class="search-input-row q-mt-md">
        <InputComponent
          v-model="hashtagInput"
          label-text="Хэштег (без #)"
          outlined
          dense
          style="flex: 1"
          :disable="!canSearch"
          @keyup.enter="searchHashtagHandler"
        />
        <ButtonComponent
          icon="search"
          color="primary"
          :loading="searchStore.searchLoading"
          :disable="!canSearch || !hashtagInput.trim()"
          @click="searchHashtagHandler"
        />
      </div>

      <div v-else class="search-input-row q-mt-md">
        <q-select
          v-model="selectedLocation"
          :options="searchStore.locations"
          option-label="name"
          label="Поиск места"
          outlined
          dense
          use-input
          clearable
          input-debounce="400"
          style="flex: 1"
          :loading="searchStore.locationsLoading"
          :disable="!canSearch"
          @filter="locationFilterHandler"
          @update:model-value="selectLocationHandler"
        >
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.name }}</q-item-label>
                <q-item-label v-if="scope.opt.address" caption>{{ scope.opt.address }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
          <template #no-option>
            <q-item>
              <q-item-section class="text-grey">Введите минимум 2 символа для поиска</q-item-section>
            </q-item>
          </template>
        </q-select>
      </div>
    </div>

    <div v-if="!canSearch" class="row justify-center q-pa-xl text-grey">
      <div class="column items-center">
        <q-icon name="manage_search" size="64px" color="grey-3" />
        <p class="q-mt-sm">Выберите аккаунт для поиска</p>
      </div>
    </div>

    <div v-else-if="searchStore.searchLoading" class="row justify-center q-pa-xl">
      <q-spinner size="48px" color="primary" />
    </div>

    <div v-else-if="searchStore.searchResults.length === 0" class="row justify-center q-pa-xl text-grey">
      <div class="column items-center">
        <q-icon name="photo_library" size="64px" color="grey-3" />
        <p class="q-mt-sm">Введите запрос для поиска</p>
      </div>
    </div>

    <div v-else>
      <MasonryGrid :items="searchStore.searchResults" :get-item-height="getPostHeight">
        <template #default="{ item }">
          <MediaCard
            :key="item.pk"
            :post="item"
            :is-liking="feedStore.isLiking"
            :loading-user-pk="loadingUserPk"
            @open="openPostHandler"
            @like="likePostHandler"
            @open-user="openUserHandler"
          />
        </template>
      </MasonryGrid>

      <div v-if="searchStore.canLoadMore" class="row justify-center q-pa-md">
        <q-btn
          label="Загрузить ещё"
          color="primary"
          outline
          :loading="searchStore.loadMoreLoading"
          @click="loadMoreHandler"
        />
      </div>
    </div>

    <PostDetailModal
      v-if="selectedPost && selectedAccount"
      v-model="postModal.isVisible"
      :post="selectedPost"
      :account-id="selectedAccount.id"
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
  </q-page>
</template>

<style scoped lang="scss">
  .search-page {
    max-width: 1200px;
    margin: 0 auto;
  }

  .controls {
    background: #f9f9f9;
    border-radius: 8px;
    padding: 16px;
  }

  .search-input-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
</style>
