import { describe, it, expect, vi, beforeEach } from 'vitest'
import type * as VueRuntime from 'vue'
import type { AutomationTaskProgressEvent } from '@/entities/automation-task/model/types'

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof VueRuntime>()
  return { ...actual, onBeforeUnmount: vi.fn() }
})

let listenHandler: ((event: AutomationTaskProgressEvent) => void) | null = null

const mockChannel = {
  listen: vi.fn((_name: string, handler: (e: AutomationTaskProgressEvent) => void) => {
    listenHandler = handler
    return mockChannel
  })
}

vi.mock('@/shared/lib', () => ({
  echo: {
    private: vi.fn(() => mockChannel),
    leave: vi.fn()
  }
}))

const applyProgress = vi.fn()

vi.mock('@/entities/automation-task', () => ({
  useAutomationTaskStore: () => ({ applyProgress })
}))

import { useAutomationTaskLive } from '@/features/automation-task-live/lib/useAutomationTaskLive'

const makeEvent = (overrides: Partial<AutomationTaskProgressEvent> = {}): AutomationTaskProgressEvent => ({
  status: 'running',
  items_total: 5,
  items_done: 1,
  items_failed: 0,
  items_skipped: 0,
  current_action: 'like',
  ...overrides
})

describe('useAutomationTaskLive — фильтр parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listenHandler = null
  })

  it('событие с current_action=parsing НЕ вызывает applyProgress', () => {
    useAutomationTaskLive().subscribe(1)
    listenHandler?.(makeEvent({ current_action: 'parsing' }))
    expect(applyProgress).not.toHaveBeenCalled()
  })

  it('обычное событие (current_action=like) применяется через applyProgress', () => {
    useAutomationTaskLive().subscribe(1)
    const event = makeEvent({ current_action: 'like' })
    listenHandler?.(event)
    expect(applyProgress).toHaveBeenCalledWith(1, event)
  })

  it('событие current_action=null (терминал) применяется через applyProgress', () => {
    useAutomationTaskLive().subscribe(1)
    const event = makeEvent({ status: 'completed', current_action: null })
    listenHandler?.(event)
    expect(applyProgress).toHaveBeenCalledWith(1, event)
  })
})
