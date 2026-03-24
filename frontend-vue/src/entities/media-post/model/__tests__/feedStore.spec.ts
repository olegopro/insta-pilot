import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { MediaPostApi, FeedResponseApi, InstagramUserDetailApi } from '@/entities/media-post/model/apiTypes'

vi.mock('@/boot/axios', () => ({
  api: {
    get:  vi.fn(),
    post: vi.fn()
  }
}))

import { api } from '@/boot/axios'
import { useFeedStore } from '@/entities/media-post/model/feedStore'

const makeUserApi = (): MediaPostApi['user'] => ({
  pk:              '111',
  username:        'testuser',
  full_name:       'Test User',
  profile_pic_url: null
})

const makePostApi = (id = '1'): MediaPostApi => ({
  pk:               id,
  id:               `${id}_111`,
  code:             'abc',
  taken_at:         '2026-01-01T00:00:00Z',
  media_type:       1,
  thumbnail_url:    null,
  video_url:        null,
  caption_text:     'Hello',
  like_count:       10,
  comment_count:    2,
  view_count:       0,
  has_liked:        false,
  user:             makeUserApi(),
  resources:        [],
  location_name:    null,
  location_pk:      null,
  thumbnail_width:  1080,
  thumbnail_height: 1080,
  video_width:      null,
  video_height:     null
})

const makeFeedResponse = (overrides: Partial<FeedResponseApi> = {}): FeedResponseApi => ({
  posts:          [makePostApi()],
  next_max_id:    'cursor-1',
  more_available: true,
  ...overrides
})

const wrapResponse = <T>(data: T) => ({
  data: { success: true, data, message: 'OK' }
})

describe('feedStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('loadFeed загружает посты и устанавливает nextMaxId', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(makeFeedResponse()))

    const store = useFeedStore()
    await store.loadFeed(1)

    expect(store.posts).toHaveLength(1)
    expect(store.posts[0].id).toBe('1_111')
    expect(store.nextMaxId).toBe('cursor-1')
    expect(store.moreAvailable).toBe(true)
  })

  it('loadFeed сбрасывает предыдущие данные перед загрузкой', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(wrapResponse(makeFeedResponse({ posts: [makePostApi('1'), makePostApi('2')] })))
      .mockResolvedValueOnce(wrapResponse(makeFeedResponse({ posts: [makePostApi('3')] })))

    const store = useFeedStore()
    await store.loadFeed(1)
    await store.loadFeed(1)

    expect(store.posts).toHaveLength(1)
    expect(store.posts[0].pk).toBe('3')
  })

  it('loadMoreFeed дозагружает посты', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(wrapResponse(makeFeedResponse({ posts: [makePostApi('1')], next_max_id: 'cursor-2' })))
      .mockResolvedValueOnce(wrapResponse(makeFeedResponse({ posts: [makePostApi('2')], next_max_id: null, more_available: false })))

    const store = useFeedStore()
    await store.loadFeed(1)
    await store.loadMoreFeed(1)

    expect(store.posts).toHaveLength(2)
    expect(store.moreAvailable).toBe(false)
  })

  it('loadMoreFeed не загружает если moreAvailable = false', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      wrapResponse(makeFeedResponse({ more_available: false }))
    )

    const store = useFeedStore()
    await store.loadFeed(1)

    const callsBefore = vi.mocked(api.get).mock.calls.length
    await store.loadMoreFeed(1)

    expect(vi.mocked(api.get).mock.calls.length).toBe(callsBefore)
  })

  it('loadMoreFeed не дублирует уже загруженные посты', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(wrapResponse(makeFeedResponse({ posts: [makePostApi('1')] })))
      .mockResolvedValueOnce(wrapResponse(makeFeedResponse({ posts: [makePostApi('1')], more_available: false })))

    const store = useFeedStore()
    await store.loadFeed(1)
    await store.loadMoreFeed(1)

    expect(store.posts).toHaveLength(1)
    expect(store.moreAvailable).toBe(false)
  })

  it('likePost обновляет hasLiked и likeCount после успеха', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(makeFeedResponse()))
    vi.mocked(api.post).mockResolvedValueOnce(wrapResponse(null))

    const store = useFeedStore()
    await store.loadFeed(1)

    const post = store.posts[0]
    expect(post.hasLiked).toBe(false)
    expect(post.likeCount).toBe(10)

    await store.likePost(1, post)

    expect(post.hasLiked).toBe(true)
    expect(post.likeCount).toBe(11)
  })

  it('likePost при ошибке не обновляет пост', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(makeFeedResponse()))
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Forbidden'))

    const store = useFeedStore()
    await store.loadFeed(1)

    const post = store.posts[0]
    try { await store.likePost(1, post) } catch { /* expected */ }

    expect(post.hasLiked).toBe(false)
    expect(post.likeCount).toBe(10)
  })

  it('fetchUserInfo загружает профиль пользователя', async () => {
    const userDetail: InstagramUserDetailApi = {
      pk:              '999',
      username:        'iguser',
      full_name:       'IG User',
      profile_pic_url: null,
      biography:       'Bio',
      external_url:    null,
      is_private:      false,
      is_verified:     true,
      media_count:     100,
      follower_count:  5000,
      following_count: 200
    }
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(userDetail))

    const store = useFeedStore()
    await store.fetchUserInfo(1, '999')

    expect(store.userDetail?.username).toBe('iguser')
    expect(store.userDetail?.followerCount).toBe(5000)
    expect(store.userDetail?.isVerified).toBe(true)
  })

  it('refreshFeed вызывает GET с reason=pull_to_refresh', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(makeFeedResponse()))

    const store = useFeedStore()
    await store.refreshFeed(1)

    expect(api.get).toHaveBeenCalledWith(
      '/feed/1',
      expect.objectContaining({
        params: expect.objectContaining({ reason: 'pull_to_refresh' })
      })
    )
  })

  it('feedLoading изначально false', () => {
    const store = useFeedStore()
    expect(store.feedLoading).toBe(false)
  })

  it('isLiking возвращает false до начала лайка', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(makeFeedResponse()))

    const store = useFeedStore()
    await store.loadFeed(1)

    expect(store.isLiking(store.posts[0].id)).toBe(false)
  })

  it('feedLoading маппит посты в camelCase', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(makeFeedResponse()))

    const store = useFeedStore()
    await store.loadFeed(1)

    expect(store.posts[0].captionText).toBe('Hello')
    expect(store.posts[0].likeCount).toBe(10)
    expect(store.posts[0].user.username).toBe('testuser')
  })
})
