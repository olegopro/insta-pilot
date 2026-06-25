import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { apiData, useApi, isCancelledRequest, type ApiResponseWrapper } from '@/shared/api'
import { compactParams, notifyError, type Nullable } from '@/shared/lib'
import type {
  ShowcaseProfile,
  ShowcaseMedia,
  ShowcaseOverlayPatch,
  ShowcaseBoardOrderItem
} from '@/entities/showcase-media/model/types'
import type {
  ShowcaseProfileApi,
  ShowcaseMediasResponseApi,
  ShowcaseOverlayApi,
  ShowcaseOverlayPatchApi,
  ShowcaseBoardOrderRequestApi
} from '@/entities/showcase-media/model/apiTypes'
import { SHOWCASE_MEDIAS_AMOUNT } from '@/entities/showcase-media/model/constants'
import showcaseMediaDTO from '@/entities/showcase-media/model/showcaseMediaDTO'

const compareBoardPosition = (first: ShowcaseMedia, second: ShowcaseMedia): number => {
  const positionFirst = first.overlay.boardPosition
  const positionSecond = second.overlay.boardPosition
  if (positionFirst === null && positionSecond === null) return 0
  if (positionFirst === null) return 1
  if (positionSecond === null) return -1
  return positionFirst - positionSecond
}

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

  const updateOverlayApi = useApi<ApiResponseWrapper<ShowcaseOverlayApi>, {
    accountId: number;
    mediaPk: string;
    body: ShowcaseOverlayPatchApi
  }>(
    ({ accountId, mediaPk, body }, signal) =>
      apiData(api.patch(`/showcase/${String(accountId)}/media/${mediaPk}/overlay`, body, { signal }))
  )

  const reorderBoardApi = useApi<ApiResponseWrapper<null>, {
    accountId: number;
    body: ShowcaseBoardOrderRequestApi
  }>(
    ({ accountId, body }, signal) =>
      apiData(api.put(`/showcase/${String(accountId)}/board/order`, body, { signal }))
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

  const updateOverlay = async (accountId: number, mediaPk: string, patch: ShowcaseOverlayPatch): Promise<boolean> => {
    const media = posts.value.find((item) => item.post.pk === mediaPk)
    const previousOverlay = media ? { ...media.overlay } : null

    if (media) media.overlay = { ...media.overlay, ...patch }

    try {
      const { data } = await updateOverlayApi.execute({
        accountId,
        mediaPk,
        body: showcaseMediaDTO.toApiOverlayPatch(patch)
      })
      if (media) media.overlay = showcaseMediaDTO.toLocalOverlay(data)
      return true
    } catch (error: unknown) {
      if (isCancelledRequest(error)) return false
      if (media && previousOverlay) media.overlay = previousOverlay
      notifyError(updateOverlayApi.error.value ?? 'Не удалось сохранить изменения')
      return false
    }
  }

  const reorderBoard = async (accountId: number, order: ShowcaseBoardOrderItem[]): Promise<boolean> => {
    const snapshot = posts.value.map((media) => ({ media, position: media.overlay.boardPosition }))
    const positionByPk = new Map(order.map((item) => [item.mediaPk, item.position]))

    posts.value.forEach((media) => {
      const position = positionByPk.get(media.post.pk)
      if (position !== undefined) media.overlay.boardPosition = position
    })
    posts.value = [...posts.value].sort(compareBoardPosition)

    try {
      await reorderBoardApi.execute({ accountId, body: { order: showcaseMediaDTO.toApiBoardOrder(order) } })
      return true
    } catch (error: unknown) {
      if (isCancelledRequest(error)) return false
      snapshot.forEach(({ media, position }) => media.overlay.boardPosition = position)
      posts.value = snapshot.map(({ media }) => media)
      notifyError(reorderBoardApi.error.value ?? 'Не удалось сохранить порядок')
      return false
    }
  }

  const sortedPosts = computed(() => [...posts.value].sort(compareBoardPosition))

  const profileLoading = computed(() => fetchProfileApi.loading.value)
  const profileError = computed(() => fetchProfileApi.error.value)
  const mediasLoading = computed(() => fetchMediasApi.loading.value)
  const mediasError = computed(() => fetchMediasApi.error.value)
  const loadMoreLoading = computed(() => loadMoreApi.loading.value)
  const updateOverlayLoading = computed(() => updateOverlayApi.loading.value)
  const reorderBoardLoading = computed(() => reorderBoardApi.loading.value)

  const cancelProfile = () => fetchProfileApi.abort()
  const cancelMedias = () => fetchMediasApi.abort()
  const cancelLoadMore = () => loadMoreApi.abort()

  return {
    profile,
    posts,
    sortedPosts,
    nextCursor,
    moreAvailable,
    fetchProfile,
    fetchMedias,
    loadMore,
    updateOverlay,
    reorderBoard,
    profileLoading,
    profileError,
    mediasLoading,
    mediasError,
    loadMoreLoading,
    updateOverlayLoading,
    reorderBoardLoading,
    cancelProfile,
    cancelMedias,
    cancelLoadMore
  }
})
