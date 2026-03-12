import { describe, it, expect } from 'vitest'
import instagramAccountListDTO from '@/entities/instagram-account/model/instagramAccountListDTO'
import type { InstagramAccount } from '@/entities/instagram-account/model/types'

const makeAccount = (overrides: Partial<InstagramAccount> = {}): InstagramAccount => ({
  id: 1,
  instagram_login: 'testuser',
  full_name: 'Test Account',
  profile_pic_url: null,
  proxy: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
})

describe('instagramAccountListDTO.toLocal', () => {
  it('маппит snake_case поля в camelCase', () => {
    const result = instagramAccountListDTO.toLocal([makeAccount()])

    expect(result[0]).toMatchObject({
      id: 1,
      instagramLogin: 'testuser',
      fullName: 'Test Account',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z'
    })
  })

  it('возвращает пустой массив при пустом входе', () => {
    expect(instagramAccountListDTO.toLocal([])).toEqual([])
  })

  it('маппит несколько аккаунтов', () => {
    const accounts = [makeAccount({ id: 1 }), makeAccount({ id: 2, instagram_login: 'second' })]

    const result = instagramAccountListDTO.toLocal(accounts)

    expect(result).toHaveLength(2)
    expect(result).toMatchObject([{}, { instagramLogin: 'second' }])
  })
})
