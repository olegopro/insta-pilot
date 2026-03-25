import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('@/boot/axios', () => ({
  api: { get: vi.fn(), post: vi.fn() }
}))

let subscribedCallback: (() => void) | null = null

const mockChannel = {
  listen:     vi.fn(() => mockChannel),
  subscribed: vi.fn((cb: () => void) => { subscribedCallback = cb; return mockChannel })
}

vi.mock('@/shared/lib', () => ({
  echo: {
    private: vi.fn(() => mockChannel),
    leave:   vi.fn()
  }
}))

import { echo } from '@/shared/lib'
import { useActivityLive } from '@/features/activity-live/lib/useActivityLive'

const mountComposable = (initialAccountId: number) => {
  const accountId = ref(initialAccountId)

  const TestComponent = defineComponent({
    setup() {
      const result = useActivityLive(accountId)
      return { ...result, accountId }
    },
    render: () => h('div')
  })

  const wrapper = mount(TestComponent)
  return { wrapper, accountId }
}

describe('useActivityLive', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    subscribedCallback = null
  })

  it('подписывается на канал account-activity.{accountId} при монтировании', () => {
    mountComposable(42)
    expect(echo.private).toHaveBeenCalledWith('account-activity.42')
    expect(mockChannel.listen).toHaveBeenCalledWith('.ActivityLogCreated', expect.any(Function))
  })

  it('isConnected становится true после subscribed()', () => {
    const { wrapper } = mountComposable(1)
    subscribedCallback?.()
    expect((wrapper.vm as { isConnected: boolean }).isConnected).toBe(true)
  })

  it('не подписывается если accountId = 0', () => {
    mountComposable(0)
    expect(echo.private).not.toHaveBeenCalled()
  })

  it('watch accountId → переподписывается на новый канал', async () => {
    const { wrapper, accountId } = mountComposable(1)
    accountId.value = 2
    await wrapper.vm.$nextTick()

    expect(echo.leave).toHaveBeenCalledWith('account-activity.1')
    expect(echo.private).toHaveBeenCalledWith('account-activity.2')
  })

  it('onBeforeUnmount → отписывается от канала', () => {
    const { wrapper } = mountComposable(5)
    wrapper.unmount()
    expect(echo.leave).toHaveBeenCalledWith('account-activity.5')
  })
})
