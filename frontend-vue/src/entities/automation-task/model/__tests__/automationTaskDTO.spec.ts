import { describe, it, expect } from 'vitest'
import automationTaskDTO from '@/entities/automation-task/model/automationTaskDTO'
import type { AutomationTaskApi } from '@/entities/automation-task/model/apiTypes'
import type { AutomationTask } from '@/entities/automation-task/model/types'

const makeApi = (overrides: Partial<AutomationTaskApi> = {}): AutomationTaskApi => ({
  id: 30,
  instagram_account_id: 1,
  parse_run_id: 7,
  mode: 'semi_auto',
  action_type: 'comment',
  status: 'draft',
  target_count: 10,
  spread_seconds: 3600,
  jitter_seconds: 0,
  respect_working_hours: false,
  items_total: 0,
  items_done: 0,
  items_failed: 0,
  items_skipped: 0,
  collected_targets_count: 2,
  current_action: null,
  started_at: null,
  finished_at: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
})

describe('automationTaskDTO.toLocal — маппинг snake→camel', () => {
  it('переносит все поля API в локальную модель (camelCase)', () => {
    const expected: AutomationTask = {
      id: 30,
      instagramAccountId: 1,
      parseRunId: 7,
      mode: 'semi_auto',
      actionType: 'comment',
      status: 'draft',
      targetCount: 10,
      spreadSeconds: 3600,
      jitterSeconds: 0,
      respectWorkingHours: false,
      itemsTotal: 0,
      itemsDone: 0,
      itemsFailed: 0,
      itemsSkipped: 0,
      collectedTargetsCount: 2,
      currentAction: null,
      startedAt: null,
      finishedAt: null,
      createdAt: '2026-01-01T00:00:00Z'
    }

    expect(automationTaskDTO.toLocal(makeApi())).toEqual(expected)
  })

  it('маппит collected_targets_count → collectedTargetsCount', () => expect(automationTaskDTO.toLocal(makeApi({ collected_targets_count: 5 })).collectedTargetsCount).toBe(5))

  it('toLocalList применяет маппинг к каждому элементу', () => {
    const result = automationTaskDTO.toLocalList([
      makeApi({ id: 1, collected_targets_count: 0 }),
      makeApi({ id: 2, collected_targets_count: 3 })
    ])

    expect(result.map((task) => task.collectedTargetsCount)).toEqual([0, 3])
  })
})
