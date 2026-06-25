import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { apiData, useApi, type ApiResponseWrapper } from '@/shared/api'
import { compactParams, type Nullable } from '@/shared/lib'
import type { ShowcaseProfile, ShowcaseMedia } from '@/entities/showcase-media/model/types'
import type { ShowcaseProfileApi, ShowcaseMediasResponseApi } from '@/entities/showcase-media/model/apiTypes'
import { SHOWCASE_MEDIAS_AMOUNT } from '@/entities/showcase-media/model/constants'
import showcaseMediaDTO from '@/entities/showcase-media/model/showcaseMediaDTO'

export const useShowcaseStore = defineStore('showcase', () => {
  const profile = ref<Nullable<ShowcaseProfile>>(null)
  const posts = ref<ShowcaseMedia[]>([])
  const nextCursor = ref<Nullable<string>>(null)
  const moreAvailable = ref(false)

  const fetchProfileApi = useApi<ApiResponseWrapper<ShowcaseProfileApi>, number>(
    (accountId, signal) => apiData(api.get(`/showcase/${String(accountId)}/profile`, { signal }))
  )

  const fetchMediasApi = useApi<ApiResponseWrapper<ShowcaseMediasResponseApi>, number>(
    (accountId, signal) =>
      apiData(api.get(`/showcase/${String(accountId)}/medias`, {
        params: { amount: SHOWCASE_MEDIAS_AMOUNT },
        signal
      }))
  )

  const loadMoreApi = useApi<ApiResponseWrapper<ShowcaseMediasResponseApi>, {
    accountId: number;
    cursor?: string
  }>(
    ({ accountId, cursor }, signal) =>
      apiData(api.get(`/showcase/${String(accountId)}/medias`, {
        params: compactParams({ amount: SHOWCASE_MEDIAS_AMOUNT, cursor }),
        signal
      }))
  )

  const fetchProfile = async (accountId: number) => {
    profile.value = null
    const { data } = await fetchProfileApi.execute(accountId)
    profile.value = showcaseMediaDTO.toLocalProfile(data)
  }

  const fetchMedias = async (accountId: number) => {
    posts.value = []
    nextCursor.value = null
    moreAvailable.value = false

    const { data } = await fetchMediasApi.execute(accountId)
    posts.value = showcaseMediaDTO.toLocal(data.posts)
    nextCursor.value = data.next_cursor
    moreAvailable.value = data.more_available
  }

  const loadMore = async (accountId: number) => {
    if (!moreAvailable.value || loadMoreApi.loading.value) return

    const cursor = nextCursor.value ?? undefined
    const { data } = await loadMoreApi.execute({ accountId, ...compactParams({ cursor }) })

    const existingPks = new Set(posts.value.map((media) => media.post.pk))
    const newPosts = showcaseMediaDTO.toLocal(data.posts).filter((media) => !existingPks.has(media.post.pk))

    posts.value = [...posts.value, ...newPosts]
    nextCursor.value = data.next_cursor
    moreAvailable.value = data.more_available
  }

  const profileLoading = computed(() => fetchProfileApi.loading.value)
  const profileError = computed(() => fetchProfileApi.error.value)
  const mediasLoading = computed(() => fetchMediasApi.loading.value)
  const mediasError = computed(() => fetchMediasApi.error.value)
  const loadMoreLoading = computed(() => loadMoreApi.loading.value)

  const cancelProfile = () => fetchProfileApi.abort()
  const cancelMedias = () => fetchMediasApi.abort()
  const cancelLoadMore = () => loadMoreApi.abort()

  return {
    profile,
    posts,
    nextCursor,
    moreAvailable,
    fetchProfile,
    fetchMedias,
    loadMore,
    profileLoading,
    profileError,
    mediasLoading,
    mediasError,
    loadMoreLoading,
    cancelProfile,
    cancelMedias,
    cancelLoadMore
  }
})
