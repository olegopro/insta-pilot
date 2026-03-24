import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MediaCard from '@/shared/ui/media-card/MediaCard.vue'
import type { MediaPost } from '@/entities/media-post'

const makePost = (overrides: Partial<MediaPost> = {}): MediaPost => ({
  pk:              'p1',
  id:              'p1_111',
  code:            'abc',
  takenAt:         '2026-01-15T10:00:00Z',
  mediaType:       1,
  thumbnailUrl:    'https://cdn.example.com/photo.jpg',
  videoUrl:        null,
  originalThumbnailUrl: null,
  captionText:     'Nice photo!',
  likeCount:       42,
  commentCount:    5,
  viewCount:       0,
  hasLiked:        false,
  user:            { pk: '111', username: 'testuser', fullName: 'Test User', profilePicUrl: null },
  resources:       [],
  locationName:    null,
  locationPk:      null,
  thumbnailWidth:  1080,
  thumbnailHeight: 1080,
  videoWidth:      null,
  videoHeight:     null,
  ...overrides
})

const globalStubs = {
  'q-icon':    true,
  'q-avatar':  true,
  'q-spinner': true,
  ButtonComponent: {
    props: ['icon', 'color', 'loading', 'disable'],
    emits: ['click'],
    template: '<button data-like-btn @click="$emit(\'click\')">like</button>'
  }
}

describe('MediaCard', () => {
  it('рендерит thumbnail когда thumbnailUrl задан', () => {
    const wrapper = mount(MediaCard, {
      props:  { post: makePost() },
      global: { stubs: globalStubs }
    })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://cdn.example.com/photo.jpg')
  })

  it('показывает overlay со статистикой лайков и комментариев', () => {
    const wrapper = mount(MediaCard, {
      props:  { post: makePost({ likeCount: 100, commentCount: 20 }) },
      global: { stubs: globalStubs }
    })
    expect(wrapper.text()).toContain('100')
    expect(wrapper.text()).toContain('20')
  })

  it('emit open при клике на карточку', async () => {
    const wrapper = mount(MediaCard, {
      props:  { post: makePost() },
      global: { stubs: globalStubs }
    })
    await wrapper.find('.card').trigger('click')
    expect(wrapper.emitted('open')).toBeTruthy()
    expect(wrapper.emitted('open')?.[0]?.[0]).toMatchObject({ pk: 'p1' })
  })

  it('показывает иконку video для mediaType=2, carousel для mediaType=8', () => {
    // Проверяем через mediaType — badges рендерятся в шаблоне через q-icon с разными name
    const videoCard = mount(MediaCard, {
      props:  { post: makePost({ mediaType: 2 }) },
      global: { stubs: { ...globalStubs, 'q-icon': { props: ['name'], template: '<span :data-icon="name"></span>' } } }
    })
    expect(videoCard.find('[data-icon="play_circle_filled"]').exists()).toBe(true)

    const carouselCard = mount(MediaCard, {
      props:  { post: makePost({ mediaType: 8 }) },
      global: { stubs: { ...globalStubs, 'q-icon': { props: ['name'], template: '<span :data-icon="name"></span>' } } }
    })
    expect(carouselCard.find('[data-icon="collections"]').exists()).toBe(true)
  })
})
