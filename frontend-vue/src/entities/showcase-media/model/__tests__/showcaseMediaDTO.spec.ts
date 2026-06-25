import { describe, it, expect } from 'vitest'
import showcaseMediaDTO from '@/entities/showcase-media/model/showcaseMediaDTO'
import type {
  ShowcaseProfileApi,
  ShowcaseOverlayApi,
  ShowcaseMediaApi
} from '@/entities/showcase-media/model/apiTypes'

const makeProfileApi = (overrides: Partial<ShowcaseProfileApi> = {}): ShowcaseProfileApi => ({
  user_pk:         '999',
  username:        'showcaseuser',
  full_name:       'Showcase User',
  profile_pic_url: null,
  biography:       'My showcase bio',
  media_count:     150,
  follower_count:  5000,
  following_count: 200,
  is_private:      false,
  is_verified:     true,
  ...overrides
})

const makeOverlayApi = (overrides: Partial<ShowcaseOverlayApi> = {}): ShowcaseOverlayApi => ({
  board_position:  3,
  is_ad:           false,
  is_tracked:      true,
  is_hidden_local: false,
  note:            'a note',
  labels:          ['promo', 'top'],
  ...overrides
})

const makeMediaApi = (overrides: Partial<ShowcaseMediaApi> = {}): ShowcaseMediaApi => ({
  pk:               'p1',
  id:               'p1_999',
  code:             'abc123',
  taken_at:         '2026-01-15T10:00:00Z',
  media_type:       1,
  thumbnail_url:    null,
  video_url:        null,
  caption_text:     'Showcase photo',
  like_count:       42,
  comment_count:    5,
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
  overlay:          makeOverlayApi(),
  ...overrides
})

describe('showcaseMediaDTO.toLocalProfile', () => {
  it('маппит профиль из snake_case в camelCase', () => {
    const result = showcaseMediaDTO.toLocalProfile(makeProfileApi())

    expect(result).toMatchObject({
      userPk:         '999',
      username:       'showcaseuser',
      fullName:       'Showcase User',
      biography:      'My showcase bio',
      mediaCount:     150,
      followerCount:  5000,
      followingCount: 200,
      isPrivate:      false,
      isVerified:     true
    })
  })

  it('profilePicUrl = null если profile_pic_url = null', () => {
    const result = showcaseMediaDTO.toLocalProfile(makeProfileApi({ profile_pic_url: null }))
    expect(result.profilePicUrl).toBeNull()
  })

  it('profilePicUrl проксируется через /api/proxy/image при наличии url', () => {
    const result = showcaseMediaDTO.toLocalProfile(makeProfileApi({
      profile_pic_url: 'https://cdninstagram.com/avatar.jpg'
    }))
    expect(result.profilePicUrl).toContain('/api/proxy/image?url=')
  })
})

describe('showcaseMediaDTO.toLocalOverlay', () => {
  it.each([
    ['board_position', { board_position: null }, 'boardPosition', null],
    ['note', { note: null }, 'note', null],
    ['labels', { labels: null }, 'labels', null]
  ] as const)('маппит nullable поле overlay %s в null', (_label, override, field, expected) => {
    const result = showcaseMediaDTO.toLocalOverlay(makeOverlayApi(override))
    expect(result[field]).toBe(expected)
  })

  it('маппит булевы флаги и значения overlay из snake_case в camelCase', () => {
    const result = showcaseMediaDTO.toLocalOverlay(makeOverlayApi())

    expect(result).toEqual({
      boardPosition: 3,
      isAd:          false,
      isTracked:     true,
      isHiddenLocal: false,
      note:          'a note',
      labels:        ['promo', 'top']
    })
  })
})

describe('showcaseMediaDTO.toLocalMedia', () => it('маппит is_pinned, overlay и переиспользует mediaPostDTO для поста', () => {
  const result = showcaseMediaDTO.toLocalMedia(makeMediaApi({ is_pinned: true }))

  expect(result.isPinned).toBe(true)
  expect(result.overlay.boardPosition).toBe(3)
  expect(result.post).toMatchObject({
    pk:          'p1',
    code:        'abc123',
    captionText: 'Showcase photo',
    likeCount:   42,
    mediaType:   1
  })
}))

describe('showcaseMediaDTO.toLocal', () => {
  it('маппит массив постов витрины', () => {
    const result = showcaseMediaDTO.toLocal([makeMediaApi({ pk: 'p1' }), makeMediaApi({ pk: 'p2' })])

    expect(result).toHaveLength(2)
    expect(result[0]!.post.pk).toBe('p1')
    expect(result[1]!.post.pk).toBe('p2')
  })

  it('возвращает пустой массив при пустом входе', () => expect(showcaseMediaDTO.toLocal([])).toEqual([]))
})
