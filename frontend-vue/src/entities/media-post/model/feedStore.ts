import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import type { Nullable } from '@/shared/lib'
import type { MediaPost, InstagramUserDetail } from './types'
import type { FeedResponseApi, InstagramUserDetailApi } from './apiTypes'
import mediaPostDTO from './mediaPostDTO'

const MAX_SEEN_POSTS = 100
const CACHE_ENABLED_KEY = 'feed_cache_enabled_'
const SEEN_POSTS_KEY = 'feed_seen_posts_'
const MIN_POSTS_KEY = 'feed_min_posts'

export const useFeedStore = defineStore('feed', () => {
  const posts = ref<MediaPost[]>([])
  const nextMaxId = ref<Nullable<string>>(null)
  const moreAvailable = ref(false)
  const seenPosts = ref<string[]>([])
  const userDetail = ref<Nullable<InstagramUserDetail>>(null)
  const cacheEnabled = ref(false)
  const minPostsPerLoad = ref<Nullable<number>>((() => {
    const saved = localStorage.getItem(MIN_POSTS_KEY)
    return saved ? Number(saved) : null
  })())

  const loadCacheState = (accountId: number) => {
    cacheEnabled.value = localStorage.getItem(`${CACHE_ENABLED_KEY}${String(accountId)}`) === '1'
  }

  const setCacheEnabled = (accountId: number, enabled: boolean) => {
    cacheEnabled.value = enabled
    localStorage.setItem(`${CACHE_ENABLED_KEY}${String(accountId)}`, enabled ? '1' : '0')
  }

  const saveSeenPostsCache = (accountId: number) => {
    localStorage.setItem(`${SEEN_POSTS_KEY}${String(accountId)}`, JSON.stringify(seenPosts.value))
  }

  const getSeenPostsCache = (accountId: number): string[] => {
    try {
      const raw = localStorage.getItem(`${SEEN_POSTS_KEY}${String(accountId)}`)
      return raw ? JSON.parse(raw) as string[] : []
    } catch {
      return []
    }
  }

  const fetchFeedApi = useApi<ApiResponseWrapper<FeedResponseApi>, { accountId: number; reason?: string; minPosts?: number }>(
    ({ accountId, reason, minPosts }) =>
      api.get(`/feed/${String(accountId)}`, {
        params: {
          ...(reason ? { reason } : {}),
          ...(minPosts ? { min_posts: minPosts } : {})
        }
      }).then((response) => response.data)
  )

  const likeFeedApi = useApi<ApiResponseWrapper<null>, { accountId: number; mediaId: string }>(
    ({ accountId, mediaId }) =>
      api.post(`/feed/${String(accountId)}/like`, { media_id: mediaId }).then((response) => response.data)
  )

  const fetchUserInfoApi = useApi<ApiResponseWrapper<InstagramUserDetailApi>, { accountId: number; userPk: string }>(
    ({ accountId, userPk }) =>
      api.get(`/instagram-user/${String(accountId)}/${userPk}`).then((response) => response.data)
  )

  const loadFeed = async (accountId: number, reason?: string) => {
    if (fetchFeedApi.loading.value) return
    posts.value = []
    nextMaxId.value = null
    moreAvailable.value = false
    seenPosts.value = []
    loadCacheState(accountId)

    const minPosts = minPostsPerLoad.value ?? undefined

    const { data } = await fetchFeedApi.execute({ accountId, ...(reason ? { reason } : {}), ...(minPosts ? { minPosts } : {}) })
    posts.value = mediaPostDTO.toLocal(data.posts)
    nextMaxId.value = data.next_max_id
    moreAvailable.value = data.more_available

    const newIds = data.posts.map((post) => post.id)
    if (cacheEnabled.value) {
      const cached = getSeenPostsCache(accountId)
      seenPosts.value = [...new Set([...cached, ...newIds])].slice(-MAX_SEEN_POSTS)
    } else {
      seenPosts.value = newIds
    }
    saveSeenPostsCache(accountId)
  }

  const refreshFeed = (accountId: number) => loadFeed(accountId, 'pull_to_refresh')

  const setMinPostsPerLoad = (value: Nullable<number>) => {
    minPostsPerLoad.value = value
    if (value !== null) {
      localStorage.setItem(MIN_POSTS_KEY, String(value))
    } else {
      localStorage.removeItem(MIN_POSTS_KEY)
    }
  }

  const loadMoreApi = useApi<ApiResponseWrapper<FeedResponseApi>,{ accountId: number; maxId?: string; seenPostsParam?: string; minPosts?: number }>(
    ({ accountId, maxId, seenPostsParam, minPosts }) =>
      api.get(`/feed/${String(accountId)}`, {
        params: {
          ...(maxId ? { max_id: maxId } : {}),
          ...(seenPostsParam ? { seen_posts: seenPostsParam } : {}),
          ...(minPosts ? { min_posts: minPosts } : {})
        }
      }).then((response) => response.data)
  )

  const loadMoreFeed = async (accountId: number) => {
    if (!moreAvailable.value || loadMoreApi.loading.value) return

    let effectiveSeenPosts = seenPosts.value
    if (cacheEnabled.value) {
      const cached = getSeenPostsCache(accountId)
      effectiveSeenPosts = [...new Set([...cached, ...seenPosts.value])]
    }

    const maxId = nextMaxId.value ?? undefined
    const seenPostsParam = effectiveSeenPosts.length ? effectiveSeenPosts.join(',') : undefined

    const minPosts = minPostsPerLoad.value ?? undefined

    const { data } = await loadMoreApi.execute({
      accountId,
      ...(maxId ? { maxId } : {}),
      ...(seenPostsParam ? { seenPostsParam } : {}),
      ...(minPosts ? { minPosts } : {})
    })
    const existingPks = new Set(posts.value.map((post) => post.pk))

    const newPosts = mediaPostDTO.toLocal(data.posts).filter((post) => !existingPks.has(post.pk))
    if (newPosts.length === 0) {
      moreAvailable.value = false
      return
    }

    posts.value = [...posts.value, ...newPosts]
    nextMaxId.value = data.next_max_id
    moreAvailable.value = data.more_available
    const updatedSeen = [...new Set([...seenPosts.value, ...data.posts.map((post) => post.id)])]
    seenPosts.value = updatedSeen.length > MAX_SEEN_POSTS ? updatedSeen.slice(-MAX_SEEN_POSTS) : updatedSeen
    saveSeenPostsCache(accountId)
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

  return {
    posts,
    nextMaxId,
    moreAvailable,
    userDetail,
    cacheEnabled,
    minPostsPerLoad,
    loadFeed,
    refreshFeed,
    loadMoreFeed,
    setCacheEnabled,
    setMinPostsPerLoad,
    likePost,
    isLiking,
    fetchUserInfo,
    feedLoading,
    feedError,
    userInfoLoading,
    loadMoreLoading
  }
})
