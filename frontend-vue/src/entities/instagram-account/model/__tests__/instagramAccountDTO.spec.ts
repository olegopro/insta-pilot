import { describe, it, expect } from 'vitest'
import instagramAccountDTO from '@/entities/instagram-account/model/instagramAccountDTO'
import type { InstagramAccountApi, InstagramAccountDetailedApi, DeviceProfileApi } from '@/entities/instagram-account/model/apiTypes'
import type { AddAccountRequest } from '@/entities/instagram-account/model/types'

const makeAccountApi = (overrides: Partial<InstagramAccountApi> = {}): InstagramAccountApi => ({
  id:                1,
  instagram_login:   'test_user',
  full_name:         'Test User',
  profile_pic_url:   null,
  device_profile_id: 1,
  device_model_name: 'Samsung Galaxy S20',
  is_active:         true,
  created_at:        '2026-01-01T00:00:00Z',
  ...overrides
})

describe('instagramAccountDTO.toLocal', () => {
  it('маппит snake_case в camelCase', () => {
    const result = instagramAccountDTO.toLocal(makeAccountApi())

    expect(result).toMatchObject({
      id:              1,
      instagramLogin:  'test_user',
      fullName:        'Test User',
      deviceProfileId: 1,
      deviceModelName: 'Samsung Galaxy S20',
      isActive:        true,
      createdAt:       '2026-01-01T00:00:00Z'
    })
  })

  it('profilePicUrl = null если profile_pic_url = null', () => {
    const result = instagramAccountDTO.toLocal(makeAccountApi({ profile_pic_url: null }))
    expect(result.profilePicUrl).toBeNull()
  })

  it('profilePicUrl проксируется через /api/proxy/image', () => {
    const result = instagramAccountDTO.toLocal(makeAccountApi({
      profile_pic_url: 'https://cdninstagram.com/photo.jpg'
    }))
    expect(result.profilePicUrl).toContain('/api/proxy/image?url=')
    expect(result.profilePicUrl).toContain('cdninstagram.com')
  })
})

describe('instagramAccountDTO.toLocalList', () => {
  it('маппит массив аккаунтов', () => {
    const result = instagramAccountDTO.toLocalList([
      makeAccountApi({ id: 1 }),
      makeAccountApi({ id: 2, instagram_login: 'second' })
    ])

    expect(result).toHaveLength(2)
    expect(result[1]!.instagramLogin).toBe('second')
  })

  it('возвращает пустой массив при пустом входе', () => expect(instagramAccountDTO.toLocalList([])).toEqual([]))
})

describe('instagramAccountDTO.toLocalDetailed', () => it('включает базовые поля и дополнительные (userPk, followers, following)', () => {
  const api: InstagramAccountDetailedApi = {
    ...makeAccountApi(),
    user_pk:          12345,
    followers_count:  1000,
    following_count:  500
  }

  const result = instagramAccountDTO.toLocalDetailed(api)

  expect(result.instagramLogin).toBe('test_user')
  expect(result.userPk).toBe(12345)
  expect(result.followersCount).toBe(1000)
  expect(result.followingCount).toBe(500)
}))

describe('instagramAccountDTO.toLocalDeviceProfiles', () => it('маппит массив профилей устройств', () => {
  const profiles: DeviceProfileApi[] = [
    { id: 1, code: 'samsung_s20', title: 'Samsung Galaxy S20' },
    { id: 2, code: 'pixel_6', title: 'Google Pixel 6' }
  ]

  const result = instagramAccountDTO.toLocalDeviceProfiles(profiles)

  expect(result).toHaveLength(2)
  expect(result[0]!.code).toBe('samsung_s20')
  expect(result[1]!.title).toBe('Google Pixel 6')
}))

describe('instagramAccountDTO.toApiRequest', () => it('преобразует camelCase в snake_case для отправки на API', () => {
  const request: AddAccountRequest = {
    instagramLogin:    'user123',
    instagramPassword: 'secret',
    deviceProfileId:   3
  }

  const result = instagramAccountDTO.toApiRequest(request)

  expect(result).toEqual({
    instagram_login:    'user123',
    instagram_password: 'secret',
    device_profile_id:  3
  })
}))
