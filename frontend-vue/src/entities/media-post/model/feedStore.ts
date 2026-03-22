import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import type { Nullable } from '@/shared/lib'
import type { MediaPost, InstagramUserDetail } from './types'
import type { FeedResponseApi, InstagramUserDetailApi } from './apiTypes'
import mediaPostDTO from './mediaPostDTO'
import { useFeedCache } from './useFeedCache'

export const useFeedStore = defineStore('feed', () => {
  const posts = ref<MediaPost[]>([])
  const nextMaxId = ref<Nullable<string>>(null)
  const moreAvailable = ref(false)
  const userDetail = ref<Nullable<InstagramUserDetail>>(null)

  const cache = useFeedCache()

  const fetchFeedApi = useApi<ApiResponseWrapper<FeedResponseApi>, { accountId: number; reason?: string; minPosts?: number }>(
    ({ accountId, reason, minPosts }, signal) =>
      api.get(`/feed/${String(accountId)}`, {
        params: {
          ...(reason ? { reason } : {}),
          ...(minPosts ? { min_posts: minPosts } : {})
        },
        signal
      }).then((response) => response.data)
  )

  const likeFeedApi = useApi<ApiResponseWrapper<null>, { accountId: number; mediaId: string }>(
    ({ accountId, mediaId }) =>
      api.post(`/feed/${String(accountId)}/like`, { media_id: mediaId }).then((response) => response.data)
  )

  const fetchUserInfoApi = useApi<ApiResponseWrapper<InstagramUserDetailApi>, { accountId: number; userPk: string }>(
    ({ accountId, userPk }, signal) =>
      api.get(`/instagram-user/${String(accountId)}/${userPk}`, { signal }).then((response) => response.data)
  )

  const loadFeed = async (accountId: number, reason?: string) => {
    if (fetchFeedApi.loading.value) return

    posts.value = []
    nextMaxId.value = null
    moreAvailable.value = false
    cache.resetSeenPosts()
    cache.loadCacheState(accountId)

    const minPosts = cache.minPostsPerLoad.value ?? undefined
    const { data } = await fetchFeedApi.execute({ accountId, ...(reason ? { reason } : {}), ...(minPosts ? { minPosts } : {}) })

    posts.value = mediaPostDTO.toLocal(data.posts, accountId)
    nextMaxId.value = data.next_max_id
    moreAvailable.value = data.more_available

    cache.mergeSeenPosts(accountId, data.posts.map((post) => post.id))
  }

  const refreshFeed = (accountId: number) => loadFeed(accountId, 'pull_to_refresh')

  const loadMoreApi = useApi<ApiResponseWrapper<FeedResponseApi>, { accountId: number; maxId?: string; seenPostsParam?: string; minPosts?: number }>(
    ({ accountId, maxId, seenPostsParam, minPosts }, signal) =>
      api.get(`/feed/${String(accountId)}`, {
        params: {
          ...(maxId ? { max_id: maxId } : {}),
          ...(seenPostsParam ? { seen_posts: seenPostsParam } : {}),
          ...(minPosts ? { min_posts: minPosts } : {})
        },
        signal
      }).then((response) => response.data)
  )

  const loadMoreFeed = async (accountId: number) => {
    if (!moreAvailable.value || loadMoreApi.loading.value) return

    const effectiveSeenPosts = cache.getEffectiveSeenPosts()
    const maxId = nextMaxId.value ?? undefined
    const seenPostsParam = effectiveSeenPosts.length ? effectiveSeenPosts.join(',') : undefined
    const minPosts = cache.minPostsPerLoad.value ?? undefined

    const { data } = await loadMoreApi.execute({
      accountId,
      ...(maxId ? { maxId } : {}),
      ...(seenPostsParam ? { seenPostsParam } : {}),
      ...(minPosts ? { minPosts } : {})
    })

    const existingPks = new Set(posts.value.map((post) => post.pk))
    const newPosts = mediaPostDTO.toLocal(data.posts, accountId).filter((post) => !existingPks.has(post.pk))
    if (newPosts.length === 0) {
      moreAvailable.value = false
      return
    }

    posts.value = [...posts.value, ...newPosts]
    nextMaxId.value = data.next_max_id
    moreAvailable.value = data.more_available

    cache.appendSeenPosts(accountId, data.posts.map((post) => post.id))
  }

  const likingPostIds = ref<Set<string>>(new Set())

  const likePost = async (accountId: number, post: MediaPost) => {
    likingPostIds.value.add(post.id)
    try {
      await likeFeedApi.execute({ accountId, mediaId: post.id })
      post.hasLiked = true
      post.likeCount += 1
    } finally {
      likingPostIds.value.delete(post.id)
    }
  }

  const isLiking = (postId: string) => likingPostIds.value.has(postId)

  const fetchUserInfo = async (accountId: number, userPk: string) => {
    userDetail.value = null
    const { data } = await fetchUserInfoApi.execute({ accountId, userPk })
    userDetail.value = mediaPostDTO.toLocalUserDetail(data)
  }

  const feedLoading = computed(() => fetchFeedApi.loading.value)
  const feedError = computed(() => fetchFeedApi.error.value)
  const userInfoLoading = computed(() => fetchUserInfoApi.loading.value)
  const loadMoreLoading = computed(() => loadMoreApi.loading.value)

  const cancelFeedLoad = () => fetchFeedApi.abort()
  const cancelLoadMore = () => loadMoreApi.abort()
  const cancelUserInfo = () => fetchUserInfoApi.abort()

  return {
    posts,
    nextMaxId,
    moreAvailable,
    userDetail,
    cacheEnabled: cache.cacheEnabled,
    minPostsPerLoad: cache.minPostsPerLoad,
    loadFeed,
    refreshFeed,
    loadMoreFeed,
    setCacheEnabled: cache.setCacheEnabled,
    setMinPostsPerLoad: cache.setMinPostsPerLoad,
    likePost,
    isLiking,
    fetchUserInfo,
    feedLoading,
    feedError,
    userInfoLoading,
    loadMoreLoading,
    cancelFeedLoad,
    cancelLoadMore,
    cancelUserInfo
  }
})
