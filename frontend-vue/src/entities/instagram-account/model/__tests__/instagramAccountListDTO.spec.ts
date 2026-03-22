import { describe, it, expect } from 'vitest'
import instagramAccountListDTO from '@/entities/instagram-account/model/instagramAccountListDTO'
import type { InstagramAccount } from '@/entities/instagram-account/model/types'

const makeAccount = (overrides: Partial<InstagramAccount> = {}): InstagramAccount => ({
  id: 1,
  instagramLogin: 'testuser',
  fullName: 'Test Account',
  profilePicUrl: null,
  deviceProfileId: null,
  deviceModelName: 'Samsung Galaxy S24 Ultra',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides
})

describe('instagramAccountListDTO.toLocal', () => {
  it('маппит поля в InstagramAccountRowModel', () => {
    const result = instagramAccountListDTO.toLocal([makeAccount()])

    expect(result[0]).toMatchObject({
      id: 1,
      instagramLogin: 'testuser',
      fullName: 'Test Account',
      deviceModelName: 'Samsung Galaxy S24 Ultra',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z'
    })
  })

  it('возвращает пустой массив при пустом входе', () => {
    expect(instagramAccountListDTO.toLocal([])).toEqual([])
  })

  it('маппит несколько аккаунтов', () => {
    const accounts = [makeAccount({ id: 1 }), makeAccount({ id: 2, instagramLogin: 'second' })]

    const result = instagramAccountListDTO.toLocal(accounts)

    expect(result).toHaveLength(2)
    expect(result).toMatchObject([{}, { instagramLogin: 'second' }])
  })
})
