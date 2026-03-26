import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { CommentApi, FetchCommentsResponseApi, FetchCommentRepliesResponseApi } from '@/entities/media-post/model/apiTypes'

vi.mock('@/boot/axios', () => ({
  api: {
    get: vi.fn()
  }
}))

import { api } from '@/boot/axios'
import { useCommentStore } from '@/entities/media-post/model/commentStore'

const makeCommentApi = (pk = 'c1'): CommentApi => ({
  pk,
  text:                   'Hello',
  created_at_utc:         '2026-01-01T10:00:00Z',
  like_count:             0,
  has_liked:              false,
  replied_to_comment_id:  null,
  child_comment_count:    0,
  user:                   { pk: '111', username: 'user', full_name: 'User', profile_pic_url: null },
  preview_child_comments: []
})

const wrapResponse = <T>(data: T) => ({
  data: { success: true, data, message: 'OK' }
})

describe('commentStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchComments загружает комментарии', async () => {
    const response: FetchCommentsResponseApi = {
      comments:     [makeCommentApi('c1'), makeCommentApi('c2')],
      next_min_id:  'cursor-1',
      comment_count: 2
    }
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(response))

    const store = useCommentStore()
    await store.fetchComments(1, 'media123')

    expect(store.comments).toHaveLength(2)
    expect(store.comments[0]!.pk).toBe('c1')
    expect(store.commentCount).toBe(2)
  })

  it('fetchComments сбрасывает предыдущие комментарии', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(wrapResponse({ comments: [makeCommentApi('c1'), makeCommentApi('c2')], next_min_id: null, comment_count: 2 }))
      .mockResolvedValueOnce(wrapResponse({ comments: [makeCommentApi('c3')], next_min_id: null, comment_count: 1 }))

    const store = useCommentStore()
    await store.fetchComments(1, 'media1')
    await store.fetchComments(1, 'media2')

    expect(store.comments).toHaveLength(1)
    expect(store.comments[0]!.pk).toBe('c3')
  })

  it('loadMoreComments дозагружает комментарии', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(wrapResponse({ comments: [makeCommentApi('c1')], next_min_id: 'cursor-2', comment_count: 3 }))
      .mockResolvedValueOnce(wrapResponse({ comments: [makeCommentApi('c2'), makeCommentApi('c3')], next_min_id: null, comment_count: 3 }))

    const store = useCommentStore()
    await store.fetchComments(1, 'media123')
    await store.loadMoreComments(1, 'media123')

    expect(store.comments).toHaveLength(3)
  })

  it('loadMoreComments не загружает если нет cursor', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      wrapResponse({ comments: [makeCommentApi()], next_min_id: null, comment_count: 1 })
    )

    const store = useCommentStore()
    await store.fetchComments(1, 'media123')

    const callsBefore = vi.mocked(api.get).mock.calls.length
    await store.loadMoreComments(1, 'media123')

    expect(vi.mocked(api.get).mock.calls.length).toBe(callsBefore)
  })

  it('fetchReplies загружает ответы на комментарий', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(wrapResponse({ comments: [makeCommentApi('c1')], next_min_id: null, comment_count: 1 }))
      .mockResolvedValueOnce(wrapResponse({
        child_comments:      [makeCommentApi('r1'), makeCommentApi('r2')],
        next_min_id:         null,
        child_comment_count: 2
      } satisfies FetchCommentRepliesResponseApi))

    const store = useCommentStore()
    await store.fetchComments(1, 'media123')
    await store.fetchReplies(1, 'media123', 'c1')

    const comment = store.comments[0]!
    expect(comment.childComments).toHaveLength(2)
    expect(comment.childComments[0]!.pk).toBe('r1')
  })

  it('commentsLoading изначально false', () => {
    const store = useCommentStore()
    expect(store.commentsLoading).toBe(false)
  })

  it('fetchComments при ошибке бросает исключение', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'))

    const store = useCommentStore()

    await expect(store.fetchComments(1, 'media123')).rejects.toThrow()
    expect(store.comments).toHaveLength(0)
  })

  it('loadMoreComments при ошибке бросает исключение', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(wrapResponse({ comments: [makeCommentApi()], next_min_id: 'cursor-2', comment_count: 2 }))
      .mockRejectedValueOnce(new Error('Network error'))

    const store = useCommentStore()
    await store.fetchComments(1, 'media123')

    await expect(store.loadMoreComments(1, 'media123')).rejects.toThrow()
    expect(store.comments).toHaveLength(1)
  })

  it('fetchReplies при ошибке бросает исключение', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(wrapResponse({ comments: [makeCommentApi('c1')], next_min_id: null, comment_count: 1 }))
      .mockRejectedValueOnce(new Error('Network error'))

    const store = useCommentStore()
    await store.fetchComments(1, 'media123')

    await expect(store.fetchReplies(1, 'media123', 'c1')).rejects.toThrow()
  })

  it('canLoadMore false при null cursor', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      wrapResponse({ comments: [], next_min_id: null, comment_count: 0 })
    )

    const store = useCommentStore()
    await store.fetchComments(1, 'media123')

    expect(store.canLoadMore).toBe(false)
  })
})
