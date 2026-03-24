import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useReverseInfiniteScroll } from '@/shared/lib/useReverseInfiniteScroll'

describe('useReverseInfiniteScroll', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 0 })
    Object.defineProperty(document.documentElement, 'scrollHeight', { writable: true, configurable: true, value: 1000 })
    window.scrollTo = vi.fn()
  })

  it('вызывает loadOlderFn при scrollY < 100', async () => {
    Object.defineProperty(window, 'scrollY', { writable: true, value: 50 })
    const loadOlderFn = vi.fn().mockResolvedValue(undefined)
    const { onScroll } = useReverseInfiniteScroll()

    await onScroll(loadOlderFn)

    expect(loadOlderFn).toHaveBeenCalledOnce()
  })

  it('не вызывает loadOlderFn при scrollY >= 100', async () => {
    Object.defineProperty(window, 'scrollY', { writable: true, value: 200 })
    const loadOlderFn = vi.fn().mockResolvedValue(undefined)
    const { onScroll } = useReverseInfiniteScroll()

    await onScroll(loadOlderFn)

    expect(loadOlderFn).not.toHaveBeenCalled()
  })

  it('не вызывает loadOlderFn повторно пока isLoadingOlder = true', async () => {
    Object.defineProperty(window, 'scrollY', { writable: true, value: 0 })
    let resolve!: () => void
    const pending = new Promise<void>((r) => resolve = r)
    const loadOlderFn = vi.fn(() => pending)
    const { onScroll } = useReverseInfiniteScroll()

    const first = onScroll(loadOlderFn)
    await onScroll(loadOlderFn)
    resolve()
    await first

    expect(loadOlderFn).toHaveBeenCalledOnce()
  })

  it('восстанавливает позицию скролла после добавления высоты', async () => {
    Object.defineProperty(window, 'scrollY', { writable: true, value: 0 })
    let callCount = 0
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      get: () => callCount++ === 0 ? 1000 : 1500,
      configurable: true
    })

    const loadOlderFn = vi.fn().mockResolvedValue(undefined)
    const { onScroll } = useReverseInfiniteScroll()

    await onScroll(loadOlderFn)

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'instant' })
  })

  it('не восстанавливает скролл если addedHeight = 0', async () => {
    Object.defineProperty(window, 'scrollY', { writable: true, value: 0 })
    Object.defineProperty(document.documentElement, 'scrollHeight', { writable: true, value: 1000 })

    const loadOlderFn = vi.fn().mockResolvedValue(undefined)
    const { onScroll } = useReverseInfiniteScroll()

    await onScroll(loadOlderFn)

    expect(window.scrollTo).not.toHaveBeenCalled()
  })
})
