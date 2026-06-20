import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { isCancel } from 'axios'
import { api } from '@/boot/axios'
import { apiData, useApi, type ApiResponseWrapper } from '@/shared/api'
import { compactParams, type Nullable } from '@/shared/lib'
import type { PostComment } from '@/entities/media-post/model/types'
import type { FetchCommentsResponseApi, FetchCommentRepliesResponseApi, SendCommentResponseApi } from '@/entities/media-post/model/apiTypes'
import mediaPostDTO from '@/entities/media-post/model/mediaPostDTO'

export const useCommentStore = defineStore('comments', () => {
  const comments = ref<PostComment[]>([])
  const commentsCursor = ref<Nullable<string>>(null)
  const commentCount = ref(0)

  const fetchCommentsApi = useApi<ApiResponseWrapper<FetchCommentsResponseApi>, { accountId: number; mediaPk: string; minId?: string }>(
    ({ accountId, mediaPk, minId }, signal) =>
      apiData(api.get('/media/comments', {
        params: { account_id: accountId, media_pk: mediaPk, ...compactParams({ min_id: minId }) },
        signal
      }))
  )

  const loadMoreCommentsApi = useApi<ApiResponseWrapper<FetchCommentsResponseApi>, { accountId: number; mediaPk: string; minId: string }>(
    ({ accountId, mediaPk, minId }, signal) =>
      apiData(api.get('/media/comments', {
        params: { account_id: accountId, media_pk: mediaPk, min_id: minId },
        signal
      }))
  )

  const fetchRepliesApi = useApi<ApiResponseWrapper<FetchCommentRepliesResponseApi>, { accountId: number; mediaPk: string; commentPk: string }>(
    ({ accountId, mediaPk, commentPk }, signal) =>
      apiData(api.get('/media/comments/replies', {
        params: { account_id: accountId, media_pk: mediaPk, comment_pk: commentPk },
        signal
      }))
  )

  const sendCommentApi = useApi<ApiResponseWrapper<SendCommentResponseApi>, { mediaId: string; accountId: number; text: string }>(
    ({ mediaId, accountId, text }) =>
      apiData(api.post(`/media/${mediaId}/comment`, { account_id: accountId, text }))
  )

  const fetchComments = async (accountId: number, mediaPk: string) => {
    comments.value = []
    commentsCursor.value = null
    commentCount.value = 0
    const { data } = await fetchCommentsApi.execute({ accountId, mediaPk })
    comments.value = mediaPostDTO.toLocalComments(data.comments)
    commentsCursor.value = data.next_min_id
    commentCount.value = data.comment_count
  }
  const commentsLoading = computed(() => fetchCommentsApi.loading.value)

  const loadMoreComments = async (accountId: number, mediaPk: string) => {
    if (!commentsCursor.value) return
    const { data } = await loadMoreCommentsApi.execute({ accountId, mediaPk, minId: commentsCursor.value })
    comments.value = [...comments.value, ...mediaPostDTO.toLocalComments(data.comments)]
    commentsCursor.value = data.next_min_id
  }
  const loadMoreLoading = computed(() => loadMoreCommentsApi.loading.value)
  const canLoadMore = computed(() => commentsCursor.value !== null)

  const sendComment = (mediaId: string, accountId: number, text: string) =>
    sendCommentApi.execute({ mediaId, accountId, text })
  const sendCommentLoading = computed(() => sendCommentApi.loading.value)

  const fetchReplies = async (accountId: number, mediaPk: string, commentPk: string) => {
    const comment = comments.value.find((foundComment) => foundComment.pk === commentPk)
    if (!comment) return
    comment.childCommentsLoading = true
    try {
      const { data } = await fetchRepliesApi.execute({ accountId, mediaPk, commentPk })
      comment.childComments = mediaPostDTO.toLocalComments(data.child_comments)
      comment.childCommentsCursor = data.next_min_id
    } catch (error) {
      if (!isCancel(error)) throw error
    } finally {
      comment.childCommentsLoading = false
    }
  }

  const cancelFetch = () => fetchCommentsApi.abort()

  const clearComments = () => {
    comments.value = []
    commentsCursor.value = null
    commentCount.value = 0
  }

  return {
    comments,
    commentCount,
    fetchComments,
    commentsLoading,
    loadMoreComments,
    loadMoreLoading,
    canLoadMore,
    sendComment,
    sendCommentLoading,
    fetchReplies,
    cancelFetch,
    clearComments
  }
})
