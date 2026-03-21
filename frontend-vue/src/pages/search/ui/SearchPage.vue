<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { onBeforeRouteLeave } from 'vue-router'
  import { useAccountSelect } from '@/entities/instagram-account/model/useAccountSelect'
  import { useSearchStore, useFeedStore } from '@/entities/media-post'
  import type { MediaPost, Location } from '@/entities/media-post'
  import type { Nullable } from '@/shared/lib'
  import { notifyError, notifySuccess, useModal } from '@/shared/lib'
  import { isCancelledRequest } from '@/shared/api'
  import { PageComponent } from '@/shared/ui/page-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { InputComponent } from '@/shared/ui/input-component'
  import { SelectComponent } from '@/shared/ui/select-component'
  import { MasonryGrid } from '@/shared/ui/masonry-grid'
  import { MediaCard } from '@/shared/ui/media-card'
  import { EmptyStateComponent } from '@/shared/ui/empty-state-component'
  import { PostDetailModal } from '@/features/post-detail'
  import { InstagramUserModal } from '@/features/instagram-user'
  import AccountSelectComponent from '@/entities/instagram-account/ui/AccountSelectComponent.vue'
  import type { SearchMode } from '../model/types'

  const { selectedAccount, accountSelectRef, accountStackLabel, isInitializing, initAccounts } = useAccountSelect('search_selected_account_id')

  const searchStore = useSearchStore()
  const feedStore = useFeedStore()

  const selectedPost = ref<Nullable<MediaPost>>(null)
  const searchMode = ref<SearchMode>('hashtag')
  const hashtagInput = ref('')
  const selectedLocation = ref<Nullable<Location>>(null)
  const loadingUserPk = ref<Nullable<string>>(null)

  const postModal = useModal()
  const userModal = useModal()

  const searchModeOptions = [
    { label: 'Хэштег', value: 'hashtag' as SearchMode, icon: 'tag' },
    { label: 'Геолокация', value: 'location' as SearchMode, icon: 'location_on' }
  ]

  const canSearch = computed(() => !!selectedAccount.value)

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
      .catch((error: unknown) => isCancelledRequest(error) || notifyError('Ошибка поиска по хэштегу'))
  }

  const loadMoreHandler = () => {
    if (!selectedAccount.value) return
    if (searchMode.value === 'hashtag') {
      const tag = hashtagInput.value.trim().replace(/^#/, '')
      searchStore.loadMoreHashtag(selectedAccount.value.id, tag)
        .catch((error: unknown) => isCancelledRequest(error) || notifyError('Ошибка загрузки'))
    } else if (selectedLocation.value) {
      searchStore.loadMoreLocationMedias(selectedAccount.value.id, selectedLocation.value.pk)
        .catch((error: unknown) => isCancelledRequest(error) || notifyError('Ошибка загрузки'))
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
    searchStore.fetchLocationMedias(selectedAccount.value.id, location)
      .catch((error: unknown) => isCancelledRequest(error) || notifyError('Ошибка загрузки медиа локации'))
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
    void initAccounts().then(() => {
      if (searchStore.lastHashtag) {
        hashtagInput.value = searchStore.lastHashtag
        searchMode.value = 'hashtag'
      } else if (searchStore.lastLocation) {
        selectedLocation.value = searchStore.lastLocation
        searchMode.value = 'location'
      }
    })
  })

  onBeforeRouteLeave(() => {
    searchStore.cancelSearch()
    searchStore.cancelSearchLoadMore()
    searchStore.cancelLocationSearch()
    searchStore.cancelLocationMedias()
    searchStore.cancelLocationMediasLoadMore()
    feedStore.cancelUserInfo()
  })
</script>

<template>
  <PageComponent title="Поиск" icon="travel_explore" class="search-page">
    <template #append>
      <AccountSelectComponent
        ref="accountSelectRef"
        v-model="selectedAccount"
        :loading="isInitializing"
        :stack-label="accountStackLabel"
      />
    </template>

    <div class="controls q-mb-md">
      <div class="mode-toggle">
        <button
          v-for="opt in searchModeOptions"
          :key="opt.value"
          :class="['mode-btn', searchMode === opt.value && 'mode-btn--active']"
          @click="switchModeHandler(opt.value)"
        >
          <q-icon :name="opt.icon" size="18px" />
          {{ opt.label }}
        </button>
      </div>

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
          icon-scale="lg"
          :loading="searchStore.searchLoading"
          :disable="!canSearch || !hashtagInput.trim()"
          @click="searchHashtagHandler"
        />
      </div>

      <div v-else class="search-input-row q-mt-md">
        <SelectComponent
          v-model="selectedLocation"
          :options="searchStore.locations"
          option-label="name"
          label="Поиск места"
          dense
          outlined
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
        </SelectComponent>
      </div>
    </div>

    <EmptyStateComponent v-if="!canSearch" icon="manage_search" text="Выберите аккаунт для поиска" />

    <div v-else-if="searchStore.searchLoading" class="loading-center">
      <q-spinner size="48px" color="primary" />
    </div>

    <EmptyStateComponent
      v-else-if="searchStore.searchResults.length === 0"
      icon="photo_library"
      text="Введите запрос для поиска"
    />

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
        <ButtonComponent
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
  </PageComponent>
</template>

<style scoped lang="scss">
  .loading-center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .controls {
    background: $surface-primary;
    border-radius: $radius-lg;
    padding: $spacing-card-padding;
    box-shadow: $elevation-card;
    border: $border-width-default $border-style-default $border-default;
  }

  .search-input-row {
    display: flex;
    gap: $spacing-inline-gap;
    align-items: stretch;
  }

  .mode-toggle {
    display: flex;
    gap: 0;
    border: $border-width-default $border-style-default $border-default;
    border-radius: $radius-md;
    overflow: hidden;
    width: fit-content;
  }

  .mode-btn {
    display: inline-flex;
    align-items: center;
    gap: $indent-xs;
    padding: $indent-s $indent-ml;
    background: $surface-primary;
    border: none;
    border-right: $border-width-default $border-style-default $border-default;
    font-size: $font-size-base;
    font-weight: $font-weight-medium;
    color: $content-secondary;
    cursor: pointer;
    transition: all $transition-fast;

    &:last-child {
      border-right: none;
    }

    &:hover:not(.mode-btn--active) {
      background: $surface-tertiary;
      color: $content-primary;
    }

    &--active {
      background: $primary;
      color: #fff;
    }
  }
</style>
