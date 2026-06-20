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
  user_pk: 12345
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

  it.each([
    {
      action:     'fetchAccounts',
      mockMethod: 'get' as const,
      invoke:     (store: ReturnType<typeof useAccountStore>) => store.fetchAccounts(),
      assertState: undefined
    },
    {
      action:     'fetchAccountDetails',
      mockMethod: 'get' as const,
      invoke:     (store: ReturnType<typeof useAccountStore>) => store.fetchAccountDetails(999),
      assertState: (store: ReturnType<typeof useAccountStore>) => expect(store.accountDetail).toBeNull()
    },
    {
      action:     'fetchDeviceProfiles',
      mockMethod: 'get' as const,
      invoke:     (store: ReturnType<typeof useAccountStore>) => store.fetchDeviceProfiles(),
      assertState: (store: ReturnType<typeof useAccountStore>) => expect(store.deviceProfiles).toHaveLength(0)
    },
    {
      action:     'deleteAccount',
      mockMethod: 'delete' as const,
      invoke:     (store: ReturnType<typeof useAccountStore>) => store.deleteAccount(1),
      assertState: undefined
    }
  ])('$action при ошибке бросает исключение', async ({ mockMethod, invoke, assertState }) => {
    vi.mocked(api[mockMethod]).mockRejectedValueOnce(new Error('Request failed'))

    const store = useAccountStore()

    await expect(invoke(store)).rejects.toThrow()
    assertState?.(store)
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

})
