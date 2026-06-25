import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type * as SharedLib from '@/shared/lib'
import type {
  ShowcaseMediaApi,
  ShowcaseOverlayApi,
  ShowcaseMediasResponseApi
} from '@/entities/showcase-media/model/apiTypes'

vi.mock('@/boot/axios', () => ({
  api: {
    get:   vi.fn(),
    patch: vi.fn(),
    put:   vi.fn()
  }
}))

vi.mock('@/shared/lib', async (importOriginal) => ({
  ...await importOriginal<typeof SharedLib>(),
  notifyError: vi.fn()
}))

import { api } from '@/boot/axios'
import { notifyError } from '@/shared/lib'
import { useShowcaseStore } from '@/entities/showcase-media/model/showcaseStore'
import type { ShowcaseBoardOrderItem as BoardOrderItem } from '@/entities/showcase-media/model/types'

const makeOverlayApi = (overrides: Partial<ShowcaseOverlayApi> = {}): ShowcaseOverlayApi => ({
  board_position:  null,
  is_ad:           false,
  is_tracked:      false,
  is_hidden_local: false,
  note:            null,
  labels:          null,
  ...overrides
})

const makeMediaApi = (pk = 'p1', overlay: Partial<ShowcaseOverlayApi> = {}): ShowcaseMediaApi => ({
  pk,
  id:               `${pk}_999`,
  code:             `code_${pk}`,
  taken_at:         '2026-01-15T10:00:00Z',
  media_type:       1,
  thumbnail_url:    null,
  video_url:        null,
  caption_text:     'caption',
  like_count:       10,
  comment_count:    2,
  view_count:       0,
  has_liked:        false,
  user:             { pk: '999', username: 'showcaseuser', full_name: 'Showcase User', profile_pic_url: null },
  resources:        [],
  location_name:    null,
  location_pk:      null,
  thumbnail_width:  1080,
  thumbnail_height: 1080,
  video_width:      null,
  video_height:     null,
  is_pinned:        false,
  overlay:          makeOverlayApi(overlay)
})

const makeMediasResponse = (posts: ShowcaseMediaApi[]): ShowcaseMediasResponseApi => ({
  posts,
  next_cursor:    null,
  more_available: false
})

const wrapResponse = <T>(data: T) => ({
  data: { success: true, data, message: 'OK' }
})

const seedPosts = async (store: ReturnType<typeof useShowcaseStore>, posts: ShowcaseMediaApi[]) => {
  vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(makeMediasResponse(posts)))
  await store.fetchMedias(1)
}

describe('showcaseStore.updateOverlay', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('оптимистично обновляет overlay у нужного поста и шлёт PATCH с snake_case body', async () => {
    const store = useShowcaseStore()
    await seedPosts(store, [makeMediaApi('p1'), makeMediaApi('p2')])

    vi.mocked(api.patch).mockResolvedValueOnce(wrapResponse(makeOverlayApi({ note: 'hello' })))

    const ok = await store.updateOverlay(1, 'p1', { note: 'hello' })

    expect(ok).toBe(true)
    expect(store.posts.find((media) => media.post.pk === 'p1')!.overlay.note).toBe('hello')
    expect(store.posts.find((media) => media.post.pk === 'p2')!.overlay.note).toBeNull()
    expect(api.patch).toHaveBeenCalledWith(
      '/showcase/1/media/p1/overlay',
      { note: 'hello' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('маппит булев патч в snake_case (is_hidden_local)', async () => {
    const store = useShowcaseStore()
    await seedPosts(store, [makeMediaApi('p1')])

    vi.mocked(api.patch).mockResolvedValueOnce(wrapResponse(makeOverlayApi({ is_hidden_local: true })))

    await store.updateOverlay(1, 'p1', { isHiddenLocal: true })

    expect(api.patch).toHaveBeenCalledWith(
      '/showcase/1/media/p1/overlay',
      { is_hidden_local: true },
      expect.anything()
    )
    expect(store.posts[0]!.overlay.isHiddenLocal).toBe(true)
  })

  it('применяет оптимистичное обновление ещё до ответа сервера', async () => {
    const store = useShowcaseStore()
    await seedPosts(store, [makeMediaApi('p1')])

    let resolveFn!: (value: unknown) => void
    vi.mocked(api.patch).mockReturnValueOnce(new Promise((resolve) => resolveFn = resolve))

    const promise = store.updateOverlay(1, 'p1', { note: 'pending' })
    expect(store.posts[0]!.overlay.note).toBe('pending')

    resolveFn(wrapResponse(makeOverlayApi({ note: 'pending' })))
    await promise
  })

  it('при ошибке откатывает overlay, зовёт notifyError и возвращает false', async () => {
    const store = useShowcaseStore()
    await seedPosts(store, [makeMediaApi('p1', { note: 'original' })])

    vi.mocked(api.patch).mockRejectedValueOnce(new Error('Boom'))

    const ok = await store.updateOverlay(1, 'p1', { note: 'changed' })

    expect(ok).toBe(false)
    expect(store.posts[0]!.overlay.note).toBe('original')
    expect(notifyError).toHaveBeenCalledTimes(1)
  })
})

describe('showcaseStore.reorderBoard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('оптимистично переставляет posts[], проставляет boardPosition и шлёт PUT', async () => {
    const store = useShowcaseStore()
    await seedPosts(store, [makeMediaApi('p1'), makeMediaApi('p2'), makeMediaApi('p3')])

    vi.mocked(api.put).mockResolvedValueOnce(wrapResponse(null))

    const order: BoardOrderItem[] = [
      { mediaPk: 'p3', position: 0 },
      { mediaPk: 'p1', position: 1 },
      { mediaPk: 'p2', position: 2 }
    ]
    const ok = await store.reorderBoard(1, order)

    expect(ok).toBe(true)
    expect(store.posts.map((media) => media.post.pk)).toEqual(['p3', 'p1', 'p2'])
    expect(store.posts.map((media) => media.overlay.boardPosition)).toEqual([0, 1, 2])
    expect(api.put).toHaveBeenCalledWith(
      '/showcase/1/board/order',
      { order: [
        { media_pk: 'p3', position: 0 },
        { media_pk: 'p1', position: 1 },
        { media_pk: 'p2', position: 2 }
      ] },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('при ошибке откатывает порядок и boardPosition, зовёт notifyError и возвращает false', async () => {
    const store = useShowcaseStore()
    await seedPosts(store, [makeMediaApi('p1'), makeMediaApi('p2'), makeMediaApi('p3')])

    vi.mocked(api.put).mockRejectedValueOnce(new Error('Boom'))

    const order: BoardOrderItem[] = [
      { mediaPk: 'p3', position: 0 },
      { mediaPk: 'p1', position: 1 },
      { mediaPk: 'p2', position: 2 }
    ]
    const ok = await store.reorderBoard(1, order)

    expect(ok).toBe(false)
    expect(store.posts.map((media) => media.post.pk)).toEqual(['p1', 'p2', 'p3'])
    expect(store.posts.map((media) => media.overlay.boardPosition)).toEqual([null, null, null])
    expect(notifyError).toHaveBeenCalledTimes(1)
  })
})

describe('showcaseStore.sortedPosts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('сортирует по boardPosition: null в конце, IG-порядок сохраняется (stable)', async () => {
    const store = useShowcaseStore()
    await seedPosts(store, [
      makeMediaApi('p1', { board_position: 2 }),
      makeMediaApi('p2', { board_position: null }),
      makeMediaApi('p3', { board_position: 1 }),
      makeMediaApi('p4', { board_position: null })
    ])

    expect(store.sortedPosts.map((media) => media.post.pk)).toEqual(['p3', 'p1', 'p2', 'p4'])
  })

  it('не мутирует исходный posts[]', async () => {
    const store = useShowcaseStore()
    await seedPosts(store, [
      makeMediaApi('p1', { board_position: 5 }),
      makeMediaApi('p2', { board_position: 1 })
    ])

    void store.sortedPosts
    expect(store.posts.map((media) => media.post.pk)).toEqual(['p1', 'p2'])
  })
})
