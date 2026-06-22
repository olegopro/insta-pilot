import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { AutomationTaskProgressEvent } from '@/entities/automation-task/model/types'

vi.mock('@/boot/axios', () => ({ api: { get: vi.fn(), post: vi.fn() } }))

import { useAutomationTaskStore } from '@/entities/automation-task/model/automationTaskStore'

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
