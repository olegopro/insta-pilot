import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { InstagramAccountApi, InstagramAccountDetailedApi, DeviceProfileApi } from '@/entities/instagram-account/model/apiTypes'

vi.mock('@/boot/axios', () => ({
  api: {
    get:    vi.fn(),
    post:   vi.fn(),
    delete: vi.fn()
  }
}))

import { api } from '@/boot/axios'
import { useAccountStore } from '@/entities/instagram-account/model/accountStore'

const mockAccountApi: InstagramAccountApi = {
  id:                1,
  instagram_login:   'test_user',
  full_name:         'Test User',
  profile_pic_url:   null,
  device_profile_id: 1,
  device_model_name: 'Samsung Galaxy S20',
  is_active:         true,
  created_at:        '2026-01-01T00:00:00Z'
}

const mockDetailedApi: InstagramAccountDetailedApi = {
  ...mockAccountApi,
  user_pk:          12345,
  followers_count:  500,
  following_count:  200
}

const mockDeviceProfile: DeviceProfileApi = {
  id:    1,
  code:  'samsung_s20',
  title: 'Samsung Galaxy S20'
}

describe('accountStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchAccounts загружает аккаунты в ref', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { success: true, data: [mockAccountApi], message: 'OK' }
    })

    const store = useAccountStore()
    await store.fetchAccounts()

    expect(store.accounts).toHaveLength(1)
    expect(store.accounts[0]!.instagramLogin).toBe('test_user')
  })

  it('fetchAccounts при ошибке бросает исключение', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'))

    const store = useAccountStore()

    await expect(store.fetchAccounts()).rejects.toThrow()
  })

  it('fetchAccounts маппит snake_case в camelCase', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { success: true, data: [mockAccountApi], message: 'OK' }
    })

    const store = useAccountStore()
    await store.fetchAccounts()

    const account = store.accounts[0]!
    expect(account.isActive).toBe(true)
    expect(account.deviceModelName).toBe('Samsung Galaxy S20')
    expect(account.createdAt).toBe('2026-01-01T00:00:00Z')
  })

  it('addAccount вызывает POST /accounts/login с преобразованными ключами', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, data: mockAccountApi, message: 'OK' }
    })

    const store = useAccountStore()
    await store.addAccount({
      instagramLogin:    'new_user',
      instagramPassword: 'secret',
      deviceProfileId:   2
    })

    expect(api.post).toHaveBeenCalledWith('/accounts/login', {
      instagram_login:    'new_user',
      instagram_password: 'secret',
      device_profile_id:  2
    })
  })

  it('fetchAccountDetails загружает детали аккаунта', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { success: true, data: mockDetailedApi, message: 'OK' }
    })

    const store = useAccountStore()
    await store.fetchAccountDetails(1)

    expect(store.accountDetail).not.toBeNull()
    expect(store.accountDetail?.userPk).toBe(12345)
    expect(store.accountDetail?.followersCount).toBe(500)
    expect(store.accountDetail?.followingCount).toBe(200)
  })

  it('fetchDeviceProfiles загружает профили устройств', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { success: true, data: [mockDeviceProfile], message: 'OK' }
    })

    const store = useAccountStore()
    await store.fetchDeviceProfiles()

    expect(store.deviceProfiles).toHaveLength(1)
    expect(store.deviceProfiles[0]!.code).toBe('samsung_s20')
    expect(store.deviceProfiles[0]!.title).toBe('Samsung Galaxy S20')
  })

  it('deleteAccount вызывает DELETE /accounts/{id}', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({
      data: { success: true, data: null, message: 'OK' }
    })

    const store = useAccountStore()
    await store.deleteAccount(5)

    expect(api.delete).toHaveBeenCalledWith('/accounts/5')
  })

  it('fetchAccountsLoading изначально false', () => {
    const store = useAccountStore()
    expect(store.fetchAccountsLoading).toBe(false)
  })

  it('addAccountLoading изначально false', () => {
    const store = useAccountStore()
    expect(store.addAccountLoading).toBe(false)
  })

  it('deleteAccountLoading изначально false', () => {
    const store = useAccountStore()
    expect(store.deleteAccountLoading).toBe(false)
  })

  it('addAccountError содержит сообщение при ошибке запроса', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Forbidden'))

    const store = useAccountStore()

    try {
      await store.addAccount({
        instagramLogin:    'u',
        instagramPassword: 'p',
        deviceProfileId:   1
      })
    } catch {
      // ожидаемое исключение
    }

    expect(store.addAccountError).toBeTruthy()
  })
})
