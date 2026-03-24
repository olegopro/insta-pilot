import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import type { Nullable } from '@/shared/lib'
import type { MediaPost, Location } from '@/entities/media-post/model/types'
import type { SearchResponseApi, SearchLocationsResponseApi, SendCommentResponseApi } from '@/entities/media-post/model/apiTypes'
import mediaPostDTO from '@/entities/media-post/model/mediaPostDTO'

export const useSearchStore = defineStore('search', () => {
  const searchResults = ref<MediaPost[]>([])
  const locations = ref<Location[]>([])
  const searchCursor = ref<Nullable<string>>(null)
  const lastHashtag = ref<string>('')
  const lastLocation = ref<Nullable<Location>>(null)

  const searchHashtagApi = useApi<ApiResponseWrapper<SearchResponseApi>, { accountId: number; tag: string; amount?: number }>(
    ({ accountId, tag, amount }, signal) =>
      api.get('/search/hashtag', {
        params: { account_id: accountId, tag, ...(amount ? { amount } : {}) },
        signal
      }).then((response) => response.data)
  )

  const loadMoreHashtagApi = useApi<ApiResponseWrapper<SearchResponseApi>, { accountId: number; tag: string; nextMaxId: string }>(
    ({ accountId, tag, nextMaxId }, signal) =>
      api.get('/search/hashtag', {
        params: { account_id: accountId, tag, next_max_id: nextMaxId },
        signal
      }).then((response) => response.data)
  )

  const fetchLocationsApi = useApi<ApiResponseWrapper<SearchLocationsResponseApi>, { accountId: number; query: string }>(
    ({ accountId, query }, signal) =>
      api.get('/search/locations', {
        params: { account_id: accountId, query },
        signal
      }).then((response) => response.data)
  )

  const fetchLocationMediasApi = useApi<ApiResponseWrapper<SearchResponseApi>, { accountId: number; locationPk: number; amount?: number }>(
    ({ accountId, locationPk, amount }, signal) =>
      api.get('/search/location', {
        params: { account_id: accountId, location_pk: locationPk, ...(amount ? { amount } : {}) },
        signal
      }).then((response) => response.data)
  )

  const loadMoreLocationMediasApi = useApi<ApiResponseWrapper<SearchResponseApi>, { accountId: number; locationPk: number; nextMaxId: string }>(
    ({ accountId, locationPk, nextMaxId }, signal) =>
      api.get('/search/location', {
        params: { account_id: accountId, location_pk: locationPk, next_max_id: nextMaxId },
        signal
      }).then((response) => response.data)
  )

  const sendCommentApi = useApi<ApiResponseWrapper<SendCommentResponseApi>, { mediaId: string; accountId: number; text: string }>(
    ({ mediaId, accountId, text }) =>
      api.post(`/media/${mediaId}/comment`, { account_id: accountId, text }).then((response) => response.data)
  )

  const clearResults = () => {
    searchResults.value = []
    searchCursor.value = null
  }

  const clearLocations = () => locations.value = []

  const searchHashtag = async (accountId: number, tag: string, amount?: number) => {
    lastHashtag.value = tag
    lastLocation.value = null
    searchResults.value = []
    searchCursor.value = null
    const { data } = await searchHashtagApi.execute({ accountId, tag, ...(amount ? { amount } : {}) })
    searchResults.value = mediaPostDTO.toLocal(data.items)
    searchCursor.value = data.next_max_id ?? null
  }

  const loadMoreHashtag = async (accountId: number, tag: string) => {
    if (!searchCursor.value) return
    const { data } = await loadMoreHashtagApi.execute({ accountId, tag, nextMaxId: searchCursor.value })
    searchResults.value = [...searchResults.value, ...mediaPostDTO.toLocal(data.items)]
    searchCursor.value = data.next_max_id ?? null
  }

  const fetchLocations = async (accountId: number, query: string) => {
    locations.value = []
    const { data } = await fetchLocationsApi.execute({ accountId, query })
    locations.value = data.locations
  }

  const fetchLocationMedias = async (accountId: number, location: Location, amount?: number) => {
    lastLocation.value = location
    lastHashtag.value = ''
    searchResults.value = []
    searchCursor.value = null
    const { data } = await fetchLocationMediasApi.execute({ accountId, locationPk: location.pk, ...(amount ? { amount } : {}) })
    searchResults.value = mediaPostDTO.toLocal(data.items)
    searchCursor.value = data.next_max_id ?? null
  }

  const loadMoreLocationMedias = async (accountId: number, locationPk: number) => {
    if (!searchCursor.value) return
    const { data } = await loadMoreLocationMediasApi.execute({ accountId, locationPk, nextMaxId: searchCursor.value })
    searchResults.value = [...searchResults.value, ...mediaPostDTO.toLocal(data.items)]
    searchCursor.value = data.next_max_id ?? null
  }

  const sendComment = (mediaId: string, accountId: number, text: string) =>
    sendCommentApi.execute({ mediaId, accountId, text })

  const canLoadMore = computed(() => searchResults.value.length > 0 && searchCursor.value !== null)
  const searchLoading = computed(() => searchHashtagApi.loading.value || fetchLocationMediasApi.loading.value)
  const loadMoreLoading = computed(() => loadMoreHashtagApi.loading.value || loadMoreLocationMediasApi.loading.value)
  const locationsLoading = computed(() => fetchLocationsApi.loading.value)
  const sendCommentLoading = computed(() => sendCommentApi.loading.value)

  const cancelSearch = () => searchHashtagApi.abort()
  const cancelSearchLoadMore = () => loadMoreHashtagApi.abort()
  const cancelLocationSearch = () => fetchLocationsApi.abort()
  const cancelLocationMedias = () => fetchLocationMediasApi.abort()
  const cancelLocationMediasLoadMore = () => loadMoreLocationMediasApi.abort()

  return {
    searchResults,
    locations,
    lastHashtag,
    lastLocation,
    canLoadMore,
    clearResults,
    clearLocations,
    searchHashtag,
    loadMoreHashtag,
    fetchLocations,
    fetchLocationMedias,
    loadMoreLocationMedias,
    sendComment,
    searchLoading,
    loadMoreLoading,
    locationsLoading,
    sendCommentLoading,
    cancelSearch,
    cancelSearchLoadMore,
    cancelLocationSearch,
    cancelLocationMedias,
    cancelLocationMediasLoadMore
  }
})
