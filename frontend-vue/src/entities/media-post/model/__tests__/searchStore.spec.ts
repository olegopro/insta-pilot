import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { MediaPostApi, SearchResponseApi, SearchLocationsResponseApi, LocationApi } from '@/entities/media-post/model/apiTypes'

vi.mock('@/boot/axios', () => ({
  api: {
    get:  vi.fn(),
    post: vi.fn()
  }
}))

import { api } from '@/boot/axios'
import { useSearchStore } from '@/entities/media-post/model/searchStore'

const makePostApi = (pk = '1'): MediaPostApi => ({
  pk,
  id:               `${pk}_111`,
  code:             'abc',
  taken_at:         '2026-01-01T00:00:00Z',
  media_type:       1,
  thumbnail_url:    null,
  video_url:        null,
  caption_text:     'Post',
  like_count:       5,
  comment_count:    1,
  view_count:       0,
  has_liked:        false,
  user:             { pk: '111', username: 'user', full_name: 'User', profile_pic_url: null },
  resources:        [],
  location_name:    null,
  location_pk:      null,
  thumbnail_width:  1080,
  thumbnail_height: 1080,
  video_width:      null,
  video_height:     null
})

const makeLocationApi = (pk = 1001): LocationApi => ({
  pk,
  name:    'Red Square',
  address: 'Moscow',
  lat:     55.75,
  lng:     37.62
})

const wrapResponse = <T>(data: T) => ({
  data: { success: true, data, message: 'OK' }
})

describe('searchStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('searchHashtag загружает результаты', async () => {
    const response: SearchResponseApi = { items: [makePostApi('1')], next_max_id: 'cursor-1' }
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(response))

    const store = useSearchStore()
    await store.searchHashtag(1, 'travel')

    expect(store.searchResults).toHaveLength(1)
    expect(store.searchResults[0]!.pk).toBe('1')
    expect(store.lastHashtag).toBe('travel')
  })

  it('searchHashtag сбрасывает предыдущие результаты', async () => {
    const response: SearchResponseApi = { items: [makePostApi()], next_max_id: null }
    vi.mocked(api.get)
      .mockResolvedValueOnce(wrapResponse({ items: [makePostApi('1'), makePostApi('2')], next_max_id: null }))
      .mockResolvedValueOnce(wrapResponse(response))

    const store = useSearchStore()
    await store.searchHashtag(1, 'travel')
    await store.searchHashtag(1, 'food')

    expect(store.searchResults).toHaveLength(1)
    expect(store.lastHashtag).toBe('food')
  })

  it('loadMoreHashtag дозагружает результаты', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(wrapResponse({ items: [makePostApi('1')], next_max_id: 'cursor-page2' }))
      .mockResolvedValueOnce(wrapResponse({ items: [makePostApi('2')], next_max_id: null }))

    const store = useSearchStore()
    await store.searchHashtag(1, 'travel')
    await store.loadMoreHashtag(1, 'travel')

    expect(store.searchResults).toHaveLength(2)
  })

  it('loadMoreHashtag не загружает если нет cursor', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      wrapResponse({ items: [makePostApi()], next_max_id: null })
    )

    const store = useSearchStore()
    await store.searchHashtag(1, 'travel')

    const callsBefore = vi.mocked(api.get).mock.calls.length
    await store.loadMoreHashtag(1, 'travel')

    expect(vi.mocked(api.get).mock.calls.length).toBe(callsBefore)
  })

  it('fetchLocations загружает локации', async () => {
    const response: SearchLocationsResponseApi = { locations: [makeLocationApi()] }
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(response))

    const store = useSearchStore()
    await store.fetchLocations(1, 'Moscow')

    expect(store.locations).toHaveLength(1)
    expect(store.locations[0]!.name).toBe('Red Square')
  })

  it('fetchLocationMedias загружает посты локации', async () => {
    const response: SearchResponseApi = { items: [makePostApi('5')], next_max_id: null }
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(response))

    const store = useSearchStore()
    await store.fetchLocationMedias(1, { pk: 1001, name: 'Red Square', address: 'Moscow', lat: 55.75, lng: 37.62 })

    expect(store.searchResults).toHaveLength(1)
    expect(store.searchResults[0]!.pk).toBe('5')
  })

  it('loadMoreLocationMedias дозагружает посты локации', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(wrapResponse({ items: [makePostApi('1')], next_max_id: 'cursor-2' }))
      .mockResolvedValueOnce(wrapResponse({ items: [makePostApi('2')], next_max_id: null }))

    const store = useSearchStore()
    await store.fetchLocationMedias(1, { pk: 1001, name: 'Red Square', address: 'M', lat: 55.75, lng: 37.62 })
    await store.loadMoreLocationMedias(1, 1001)

    expect(store.searchResults).toHaveLength(2)
  })

  it('sendComment вызывает POST /media/{mediaId}/comment', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(wrapResponse({ comment_pk: 'pk-1' }))

    const store = useSearchStore()
    await store.sendComment('media123', 1, 'Hello!')

    expect(api.post).toHaveBeenCalledWith(
      '/media/media123/comment',
      expect.objectContaining({ text: 'Hello!' })
    )
  })

  it('searchLoading изначально false', () => {
    const store = useSearchStore()
    expect(store.searchLoading).toBe(false)
  })

  it('canLoadMore = false при пустых результатах', () => {
    const store = useSearchStore()
    expect(store.canLoadMore).toBe(false)
  })
})
