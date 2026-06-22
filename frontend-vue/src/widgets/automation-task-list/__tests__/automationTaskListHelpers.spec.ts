import { describe, it, expect } from 'vitest'
import {
  canCancelStatus,
  isTerminalStatus,
  currentActionLabel,
  emptyTerminalText,
  taskStatsKind
} from '@/widgets/automation-task-list/lib/taskStatusMeta'
import type { AutomationTaskStatus } from '@/entities/automation-task'

describe('AutomationTaskList — чистые хелперы', () => {
  // ── currentActionLabel ────────────────────────────────────────────────────
  describe('currentActionLabel', () => it.each<[AutomationTaskStatus, string | null, string | null]>([
    ['running', 'like', 'Лайк'],
    ['running', 'comment', 'Комментарий'],
    ['running', 'parsing', null], // parsing не показываем
    ['running', null, null], // null не показываем
    ['completed', 'like', null], // терминал → не показываем
    ['failed', 'like', null],
    ['draft', 'like', null]
  ])('status=%s currentAction=%s → %s', (status, currentAction, expected) => expect(currentActionLabel({ status, currentAction })).toBe(expected)))

  // ── canCancelStatus ───────────────────────────────────────────────────────
  describe('canCancelStatus', () => it.each<[AutomationTaskStatus, boolean]>([
    ['running', true],
    ['scheduling', true],
    ['paused', true],
    ['draft', false],
    ['completed', false],
    ['failed', false],
    ['cancelled', false]
  ])('canCancelStatus(%s) → %s', (status, expected) => expect(canCancelStatus(status)).toBe(expected)))

  // ── emptyTerminalText ─────────────────────────────────────────────────────
  describe('emptyTerminalText', () => {
    it('itemsSkipped > 0 → «Все цели уже обработаны ранее»', () => expect(emptyTerminalText({ itemsSkipped: 3 })).toBe('Все цели уже обработаны ранее'))

    it('itemsSkipped === 0 → «Новых целей не найдено»', () => expect(emptyTerminalText({ itemsSkipped: 0 })).toBe('Новых целей не найдено'))
  })

  // ── isTerminalStatus (guard от показа stats-блока) ────────────────────────
  it.each<[AutomationTaskStatus, boolean]>([
    ['completed', true],
    ['failed', true],
    ['cancelled', true],
    ['running', false],
    ['draft', false]
  ])('isTerminalStatus(%s) → %s', (status, expected) => expect(isTerminalStatus(status)).toBe(expected))

  // ── taskStatsKind (что рендерим в stats-блоке карточки) ───────────────────
  describe('taskStatsKind', () => it.each<[AutomationTaskStatus, number, 'collected' | 'empty' | 'counters']>([
    ['draft', 0, 'collected'], // черновик → всегда «Собрано целей», даже при itemsTotal===0
    ['draft', 5, 'collected'],
    ['completed', 0, 'empty'], // терминал без айтемов → текст empty
    ['cancelled', 0, 'empty'],
    ['failed', 0, 'empty'],
    ['completed', 3, 'counters'], // терминал с айтемами → счётчики
    ['running', 0, 'counters'],
    ['running', 10, 'counters'],
    ['paused', 4, 'counters'],
    ['scheduling', 0, 'counters']
  ])('status=%s itemsTotal=%s → %s', (status, itemsTotal, expected) => expect(taskStatsKind({ status, itemsTotal })).toBe(expected)))
})
