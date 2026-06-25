import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { AutomationTaskProgressEvent } from '@/entities/automation-task/model/types'
import { api } from '@/boot/axios'

vi.mock('@/boot/axios', () => ({ api: { get: vi.fn(), post: vi.fn() } }))

import { useAutomationTaskStore } from '@/entities/automation-task/model/automationTaskStore'

const apiMock = vi.mocked(api)

const makeTask = (id: number) => ({
  id,
  instagramAccountId: 1,
  parseRunId: null,
  mode: 'semi_auto' as const,
  actionType: 'like' as const,
  status: 'running' as const,
  targetCount: 10,
  spreadSeconds: 3600,
  jitterSeconds: 0,
  respectWorkingHours: false,
  itemsTotal: 10,
  itemsDone: 2,
  itemsFailed: 0,
  itemsSkipped: 0,
  collectedTargetsCount: 0,
  parseStatus: null,
  parseError: null,
  currentAction: 'like' as const,
  startedAt: null,
  finishedAt: null,
  createdAt: '2026-01-01T00:00:00Z'
})

const makeEvent = (overrides: Partial<AutomationTaskProgressEvent> = {}): AutomationTaskProgressEvent => ({
  status: 'running',
  items_total: 20,
  items_done: 5,
  items_failed: 1,
  items_skipped: 2,
  current_action: 'comment',
  ...overrides
})

describe('automationTaskStore.applyProgress', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('обновляет поля задачи в tasks по данным события', () => {
    const store = useAutomationTaskStore()
    store.tasks = [makeTask(1)]

    const event = makeEvent()
    store.applyProgress(1, event)

    const task = store.tasks[0]!
    expect(task.status).toBe(event.status)
    expect(task.itemsTotal).toBe(event.items_total)
    expect(task.itemsDone).toBe(event.items_done)
    expect(task.itemsFailed).toBe(event.items_failed)
    expect(task.itemsSkipped).toBe(event.items_skipped)
    expect(task.currentAction).toBe(event.current_action)
  })

  it('обновляет currentTask если id совпадает', () => {
    const store = useAutomationTaskStore()
    store.tasks = [makeTask(1)]
    store.currentTask = makeTask(1)

    const event = makeEvent({ status: 'completed', current_action: null })
    store.applyProgress(1, event)

    expect(store.currentTask.status).toBe('completed')
    expect(store.currentTask.currentAction).toBeNull()
  })

  it('не трогает currentTask если id не совпадает', () => {
    const store = useAutomationTaskStore()
    store.tasks = [makeTask(1)]
    store.currentTask = makeTask(2)

    store.applyProgress(1, makeEvent())

    expect(store.currentTask.itemsDone).toBe(2) // без изменений
  })

  it('не падает если задача с taskId не найдена в tasks', () => {
    const store = useAutomationTaskStore()
    store.tasks = []

    expect(() => store.applyProgress(99, makeEvent())).not.toThrow()
  })
})

describe('automationTaskStore.applyParseProgress', () => {
  beforeEach(() => setActivePinia(createPinia()))

  const makeParseEvent = (overrides: Partial<AutomationTaskProgressEvent> = {}): AutomationTaskProgressEvent => ({
    status: 'parsing',
    items_total: 0,
    items_done: 0,
    items_failed: 0,
    items_skipped: 0,
    current_action: 'parsing',
    ...overrides
  })

  it('status=parsing → parseStatus=parsing, не трогает collectedTargetsCount', () => {
    const store = useAutomationTaskStore()
    store.tasks = [{ ...makeTask(1), collectedTargetsCount: 7 }]

    store.applyParseProgress(1, makeParseEvent())

    expect(store.tasks[0]!.parseStatus).toBe('parsing')
    expect(store.tasks[0]!.collectedTargetsCount).toBe(7)
  })

  it('status=completed → parseStatus=done и collectedTargetsCount из collected', () => {
    const store = useAutomationTaskStore()
    store.tasks = [makeTask(1)]

    store.applyParseProgress(1, makeParseEvent({ status: 'completed', collected: 12 }))

    expect(store.tasks[0]!.parseStatus).toBe('done')
    expect(store.tasks[0]!.collectedTargetsCount).toBe(12)
  })

  it('status=completed без collected → fallback на items_total', () => {
    const store = useAutomationTaskStore()
    store.tasks = [makeTask(1)]

    store.applyParseProgress(1, makeParseEvent({ status: 'completed', items_total: 4 }))

    expect(store.tasks[0]!.collectedTargetsCount).toBe(4)
  })

  it('status=failed → parseStatus=failed и parseError из error_message', () => {
    const store = useAutomationTaskStore()
    store.tasks = [makeTask(1)]

    store.applyParseProgress(1, makeParseEvent({ status: 'failed', error_message: 'challenge_required' }))

    expect(store.tasks[0]!.parseStatus).toBe('failed')
    expect(store.tasks[0]!.parseError).toBe('challenge_required')
  })

  it('обновляет currentTask если id совпадает', () => {
    const store = useAutomationTaskStore()
    store.tasks = [makeTask(1)]
    store.currentTask = makeTask(1)

    store.applyParseProgress(1, makeParseEvent({ status: 'completed', collected: 9 }))

    expect(store.currentTask.parseStatus).toBe('done')
    expect(store.currentTask.collectedTargetsCount).toBe(9)
  })

  it('не падает если задача с taskId не найдена', () => {
    const store = useAutomationTaskStore()
    store.tasks = []

    expect(() => store.applyParseProgress(99, makeParseEvent())).not.toThrow()
  })
})

describe('automationTaskStore.cloneTask', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const clonedApi = {
    id: 42,
    instagram_account_id: 1,
    parse_run_id: null,
    mode: 'semi_auto',
    action_type: 'like',
    status: 'draft',
    target_count: 10,
    spread_seconds: 3600,
    jitter_seconds: 0,
    respect_working_hours: false,
    items_total: 0,
    items_done: 0,
    items_failed: 0,
    items_skipped: 0,
    collected_targets_count: 0,
    parse_status: 'parsing',
    parse_error: null,
    current_action: null,
    started_at: null,
    finished_at: null,
    created_at: '2026-02-02T00:00:00Z'
  }

  it('POST /automation/{id}/clone → добавляет возвращённую задачу в начало списка', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { data: clonedApi } })
    const store = useAutomationTaskStore()
    store.tasks = [makeTask(1)]

    const task = await store.cloneTask(1)

    expect(apiMock.post).toHaveBeenCalledWith('/automation/1/clone')
    expect(task.id).toBe(42)
    expect(store.tasks[0]!.id).toBe(42)
    expect(store.tasks.map((item) => item.id)).toContain(1)
  })
})

describe('automationTaskStore.retryParse', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('POST /automation/{id}/parse-targets → ставит задаче parseStatus=parsing и чистит parseError', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { data: null } })
    const store = useAutomationTaskStore()
    store.tasks = [{ ...makeTask(1), status: 'draft', parseStatus: 'failed', parseError: 'challenge_required' }]

    await store.retryParse(1)

    expect(apiMock.post).toHaveBeenCalledWith('/automation/1/parse-targets')
    expect(store.tasks[0]!.parseStatus).toBe('parsing')
    expect(store.tasks[0]!.parseError).toBeNull()
  })
})
