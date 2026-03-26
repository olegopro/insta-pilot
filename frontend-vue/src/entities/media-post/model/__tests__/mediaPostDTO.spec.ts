import { describe, it, expect } from 'vitest'
import mediaPostDTO from '@/entities/media-post/model/mediaPostDTO'
import type {
  MediaPostApi,
  MediaUserApi,
  MediaResourceApi,
  CommentApi,
  InstagramUserDetailApi
} from '@/entities/media-post/model/apiTypes'

const makeUserApi = (overrides: Partial<MediaUserApi> = {}): MediaUserApi => ({
  pk:              '111',
  username:        'testuser',
  full_name:       'Test User',
  profile_pic_url: null,
  ...overrides
})

const makeResourceApi = (overrides: Partial<MediaResourceApi> = {}): MediaResourceApi => ({
  pk:            'r1',
  media_type:    1,
  thumbnail_url: 'https://cdninstagram.com/thumb.jpg',
  video_url:     null,
  width:         1080,
  height:        1080,
  ...overrides
})

const makePostApi = (overrides: Partial<MediaPostApi> = {}): MediaPostApi => ({
  pk:               'p1',
  id:               'p1_111',
  code:             'abc123',
  taken_at:         '2026-01-15T10:00:00Z',
  media_type:       1,
  thumbnail_url:    null,
  video_url:        null,
  caption_text:     'Nice photo!',
  like_count:       42,
  comment_count:    5,
  view_count:       0,
  has_liked:        false,
  user:             makeUserApi(),
  resources:        [],
  location_name:    'Moscow',
  location_pk:      1001,
  thumbnail_width:  1080,
  thumbnail_height: 1080,
  video_width:      null,
  video_height:     null,
  ...overrides
})

const makeCommentApi = (overrides: Partial<CommentApi> = {}): CommentApi => ({
  pk:                    'c1',
  text:                  'Great!',
  created_at_utc:        '2026-01-15T11:00:00Z',
  like_count:            2,
  has_liked:             false,
  replied_to_comment_id: null,
  child_comment_count:   1,
  user:                  { pk: '222', username: 'commenter', full_name: 'Commenter', profile_pic_url: null },
  preview_child_comments: [],
  ...overrides
})

describe('mediaPostDTO.toLocalPost', () => {
  it('маппит поля поста из snake_case в camelCase', () => {
    const result = mediaPostDTO.toLocalPost(makePostApi())

    expect(result).toMatchObject({
      pk:           'p1',
      id:           'p1_111',
      code:         'abc123',
      captionText:  'Nice photo!',
      likeCount:    42,
      commentCount: 5,
      hasLiked:     false,
      mediaType:    1,
      locationName: 'Moscow',
      locationPk:   1001
    })
  })

  it('маппит resources через toLocalResource', () => {
    const post = makePostApi({ resources: [makeResourceApi(), makeResourceApi({ pk: 'r2' })] })
    const result = mediaPostDTO.toLocalPost(post)

    expect(result.resources).toHaveLength(2)
    expect(result.resources[0]!.pk).toBe('r1')
    expect(result.resources[1]!.pk).toBe('r2')
  })

  it('маппит вложенного user', () => {
    const result = mediaPostDTO.toLocalPost(makePostApi({ user: makeUserApi({ username: 'myuser' }) }))

    expect(result.user.username).toBe('myuser')
    expect(result.user.fullName).toBe('Test User')
  })

  it('null поля остаются null', () => {
    const result = mediaPostDTO.toLocalPost(makePostApi({ thumbnail_url: null, video_url: null }))

    expect(result.thumbnailUrl).toBeNull()
    expect(result.videoUrl).toBeNull()
  })

  it('маппит viewCount из view_count', () => {
    const result = mediaPostDTO.toLocalPost(makePostApi({ view_count: 9999 }))
    expect(result.viewCount).toBe(9999)
  })

  it('location_name и location_pk null остаются null', () => {
    const result = mediaPostDTO.toLocalPost(makePostApi({ location_name: null, location_pk: null }))
    expect(result.locationName).toBeNull()
    expect(result.locationPk).toBeNull()
  })
})

describe('mediaPostDTO.toLocal', () => it('маппит массив постов', () => {
  const result = mediaPostDTO.toLocal([makePostApi({ pk: 'p1' }), makePostApi({ pk: 'p2' })])

  expect(result).toHaveLength(2)
  expect(result[0]!.pk).toBe('p1')
  expect(result[1]!.pk).toBe('p2')
}))

describe('mediaPostDTO.toLocalUserDetail', () => it('маппит расширенный профиль пользователя', () => {
  const api: InstagramUserDetailApi = {
    pk:              '999',
    username:        'iguser',
    full_name:       'IG User',
    profile_pic_url: null,
    biography:       'My bio',
    external_url:    'https://example.com',
    is_private:      false,
    is_verified:     true,
    media_count:     150,
    follower_count:  5000,
    following_count: 200
  }

  const result = mediaPostDTO.toLocalUserDetail(api)

  expect(result).toMatchObject({
    pk:             '999',
    username:       'iguser',
    biography:      'My bio',
    isPrivate:      false,
    isVerified:     true,
    mediaCount:     150,
    followerCount:  5000,
    followingCount: 200
  })
}))

describe('mediaPostDTO.toLocalComment', () => {
  it('маппит комментарий', () => {
    const result = mediaPostDTO.toLocalComment(makeCommentApi())

    expect(result).toMatchObject({
      pk:                 'c1',
      text:               'Great!',
      likeCount:          2,
      hasLiked:           false,
      childCommentCount:  1,
      childComments:      [],
      childCommentsLoading: false
    })
  })

  it('маппит preview_child_comments рекурсивно', () => {
    const comment = makeCommentApi({
      preview_child_comments: [makeCommentApi({ pk: 'reply1', text: 'Reply' })]
    })

    const result = mediaPostDTO.toLocalComment(comment)

    expect(result.previewChildComments).toHaveLength(1)
    expect(result.previewChildComments[0]!.pk).toBe('reply1')
  })
})

describe('mediaPostDTO toLocalUser profilePicUrl', () => {
  it('null если profile_pic_url = null', () => {
    const result = mediaPostDTO.toLocalUser(makeUserApi({ profile_pic_url: null }))
    expect(result.profilePicUrl).toBeNull()
  })

  it('проксируется через /api/proxy/image при наличии url', () => {
    const result = mediaPostDTO.toLocalUser(makeUserApi({
      profile_pic_url: 'https://cdninstagram.com/avatar.jpg'
    }))
    expect(result.profilePicUrl).toContain('/api/proxy/image?url=')
  })
})
