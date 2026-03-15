import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import type { MediaPost, Location } from './types'
import type { SearchResponseApi, SearchLocationsResponseApi, SendCommentResponseApi } from './apiTypes'
import mediaPostDTO from './mediaPostDTO'

export const useSearchStore = defineStore('search', () => {
  const searchResults = ref<MediaPost[]>([])
  const locations = ref<Location[]>([])
  const loadMoreLoading = ref(false)

  const searchHashtagApi = useApi<ApiResponseWrapper<SearchResponseApi>, { accountId: number; tag: string; amount?: number }>(
    ({ accountId, tag, amount }) =>
      api.get('/search/hashtag', {
        params: { account_id: accountId, tag, ...(amount ? { amount } : {}) }
      }).then((response) => response.data)
  )

  const fetchLocationsApi = useApi<ApiResponseWrapper<SearchLocationsResponseApi>, { accountId: number; query: string }>(
    ({ accountId, query }) =>
      api.get('/search/locations', {
        params: { account_id: accountId, query }
      }).then((response) => response.data)
  )

  const fetchLocationMediasApi = useApi<ApiResponseWrapper<SearchResponseApi>, { accountId: number; locationPk: number; amount?: number }>(
    ({ accountId, locationPk, amount }) =>
      api.get('/search/location', {
        params: { account_id: accountId, location_pk: locationPk, ...(amount ? { amount } : {}) }
      }).then((response) => response.data)
  )

  const sendCommentApi = useApi<ApiResponseWrapper<SendCommentResponseApi>, { mediaPk: string; accountId: number; text: string }>(
    ({ mediaPk, accountId, text }) =>
      api.post(`/media/${mediaPk}/comment`, { account_id: accountId, text }).then((response) => response.data)
  )

  const clearResults = () => {
    searchResults.value = []
  }

  const clearLocations = () => {
    locations.value = []
  }

  const searchHashtag = async (accountId: number, tag: string, amount?: number) => {
    searchResults.value = []
    const { data } = await searchHashtagApi.execute({ accountId, tag, ...(amount ? { amount } : {}) })
    searchResults.value = mediaPostDTO.toLocal(data.items)
  }

  const loadMoreHashtag = async (accountId: number, tag: string, amount: number) => {
    loadMoreLoading.value = true
    try {
      const prevCount = searchResults.value.length
      const { data } = await searchHashtagApi.execute({ accountId, tag, amount })
      const allResults = mediaPostDTO.toLocal(data.items)
      searchResults.value.push(...allResults.slice(prevCount))
    } finally {
      loadMoreLoading.value = false
    }
  }

  const fetchLocations = async (accountId: number, query: string) => {
    locations.value = []
    const { data } = await fetchLocationsApi.execute({ accountId, query })
    locations.value = data.locations
  }

  const fetchLocationMedias = async (accountId: number, locationPk: number, amount?: number) => {
    searchResults.value = []
    const { data } = await fetchLocationMediasApi.execute({ accountId, locationPk, ...(amount ? { amount } : {}) })
    searchResults.value = mediaPostDTO.toLocal(data.items)
  }

  const loadMoreLocationMedias = async (accountId: number, locationPk: number, amount: number) => {
    loadMoreLoading.value = true
    try {
      const prevCount = searchResults.value.length
      const { data } = await fetchLocationMediasApi.execute({ accountId, locationPk, amount })
      const allResults = mediaPostDTO.toLocal(data.items)
      searchResults.value.push(...allResults.slice(prevCount))
    } finally {
      loadMoreLoading.value = false
    }
  }

  const sendComment = (mediaPk: string, accountId: number, text: string) =>
    sendCommentApi.execute({ mediaPk, accountId, text })

  const searchLoading = computed(() => searchHashtagApi.loading.value || fetchLocationMediasApi.loading.value)
  const locationsLoading = computed(() => fetchLocationsApi.loading.value)
  const sendCommentLoading = computed(() => sendCommentApi.loading.value)

  return {
    searchResults,
    locations,
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
    sendCommentLoading
  }
})
