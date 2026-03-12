import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import type { Nullable } from '@/shared/lib'
import type { MediaPost, InstagramUserDetail } from './types'
import type { FeedResponseApi, InstagramUserDetailApi } from './apiTypes'
import mediaPostDTO from './mediaPostDTO'

export const useFeedStore = defineStore('feed', () => {
  const posts = ref<MediaPost[]>([])
  const nextMaxId = ref<Nullable<string>>(null)
  const moreAvailable = ref(false)
  const userDetail = ref<Nullable<InstagramUserDetail>>(null)

  const fetchFeedApi = useApi<ApiResponseWrapper<FeedResponseApi>, { accountId: number; maxId?: string }>(
    ({ accountId, maxId }) =>
      api.get(`/feed/${String(accountId)}`, { params: maxId ? { max_id: maxId } : {} }).then((response) => response.data)
  )

  const likeFeedApi = useApi<ApiResponseWrapper<null>, { accountId: number; mediaId: string }>(
    ({ accountId, mediaId }) =>
      api.post(`/feed/${String(accountId)}/like`, { media_id: mediaId }).then((response) => response.data)
  )

  const fetchUserInfoApi = useApi<ApiResponseWrapper<InstagramUserDetailApi>, { accountId: number; userPk: string }>(
    ({ accountId, userPk }) =>
      api.get(`/instagram-user/${String(accountId)}/${userPk}`).then((response) => response.data)
  )

  const loadFeed = async (accountId: number) => {
    posts.value = []
    nextMaxId.value = null
    moreAvailable.value = false
    const { data } = await fetchFeedApi.execute({ accountId })
    posts.value = mediaPostDTO.toLocal(data.posts)
    nextMaxId.value = data.next_max_id
    moreAvailable.value = data.more_available
  }

  const loadingMore = ref(false)

  const loadMoreFeed = async (accountId: number) => {
    if (!moreAvailable.value || loadingMore.value) return
    loadingMore.value = true
    try {
      const maxId = nextMaxId.value
      const { data } = await fetchFeedApi.execute(maxId ? { accountId, maxId } : { accountId })
      posts.value.push(...mediaPostDTO.toLocal(data.posts))
      nextMaxId.value = data.next_max_id
      moreAvailable.value = data.more_available
    } finally {
      loadingMore.value = false
    }
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

  return {
    posts,
    nextMaxId,
    moreAvailable,
    userDetail,
    loadFeed,
    loadMoreFeed,
    likePost,
    isLiking,
    fetchUserInfo,
    feedLoading,
    feedError,
    userInfoLoading
  }
})
