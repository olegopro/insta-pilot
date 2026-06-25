import { describe, it, expect } from 'vitest'
import {
  canCancelStatus,
  canStartStatus,
  canDeleteStatus,
  isTerminalStatus,
  currentActionLabel,
  emptyTerminalText,
  taskStatsKind,
  draftPhase,
  matchesFilter,
  filterAndSortTasks
} from '@/widgets/automation-task-list/lib/taskStatusMeta'
import type { TaskListFilter, TaskListSort } from '@/widgets/automation-task-list/lib/taskStatusMeta'
import type { AutomationTask, AutomationTaskStatus, AutomationParseStatus } from '@/entities/automation-task'

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

  // ── canStartStatus ────────────────────────────────────────────────────────
  describe('canStartStatus', () => it.each<[AutomationTaskStatus, boolean]>([
    ['draft', true],
    ['scheduling', false],
    ['running', false],
    ['paused', false],
    ['completed', false],
    ['failed', false],
    ['cancelled', false]
  ])('canStartStatus(%s) → %s', (status, expected) => expect(canStartStatus(status)).toBe(expected)))

  // ── canDeleteStatus ───────────────────────────────────────────────────────
  describe('canDeleteStatus', () => it.each<[AutomationTaskStatus, boolean]>([
    ['draft', true],
    ['completed', true],
    ['failed', true],
    ['cancelled', true],
    ['running', false],
    ['scheduling', false],
    ['paused', false]
  ])('canDeleteStatus(%s) → %s', (status, expected) => expect(canDeleteStatus(status)).toBe(expected)))

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

  // ── draftPhase (фаза черновика: сбор/готово/ошибка/нейтральный) ────────────
  describe('draftPhase', () => {
    it.each<[AutomationParseStatus | null, number, 'parsing' | 'ready' | 'failed' | 'draft']>([
      ['parsing', 0, 'parsing'], // активный сбор приоритетнее всего, даже при collected>0
      ['parsing', 5, 'parsing'],
      ['failed', 0, 'failed'],
      ['failed', 3, 'failed'], // ошибка приоритетнее «готово»
      ['done', 0, 'ready'], // парс завершён → готово, даже если count ещё 0
      ['done', 8, 'ready'],
      [null, 4, 'ready'], // бэк не прислал статус, но цели есть → деградируем к ready
      [null, 0, 'draft'] // ни статуса, ни целей → нейтральный черновик
    ])('parseStatus=%s collected=%s → kind %s', (parseStatus, collectedTargetsCount, expectedKind) =>
      expect(draftPhase({ parseStatus, collectedTargetsCount }).kind).toBe(expectedKind))

    it('parsing → label/color/icon', () => expect(draftPhase({ parseStatus: 'parsing', collectedTargetsCount: 0 })).toEqual({ kind: 'parsing', label: 'Идёт сбор целей', color: 'info', icon: 'sync' }))

    it('failed → label/color/icon', () => expect(draftPhase({ parseStatus: 'failed', collectedTargetsCount: 0 })).toEqual({ kind: 'failed', label: 'Ошибка сбора', color: 'negative', icon: 'error' }))

    it('ready → label/color/icon', () => expect(draftPhase({ parseStatus: 'done', collectedTargetsCount: 0 })).toEqual({ kind: 'ready', label: 'Готово к запуску', color: 'positive', icon: 'check_circle' }))

    it('draft → icon=null', () => expect(draftPhase({ parseStatus: null, collectedTargetsCount: 0 })).toEqual({ kind: 'draft', label: 'Черновик', color: 'grey', icon: null }))
  })

  // ── matchesFilter (тулбар фильтра списка) ─────────────────────────────────
  describe('matchesFilter', () => it.each<[AutomationTaskStatus, TaskListFilter, boolean]>([
    ['running', 'all', true],
    ['draft', 'all', true],
    ['running', 'active', true],
    ['scheduling', 'active', true],
    ['paused', 'active', true],
    ['draft', 'active', false],
    ['completed', 'active', false],
    ['draft', 'draft', true],
    ['running', 'draft', false],
    ['completed', 'completed', true],
    ['failed', 'completed', true],
    ['cancelled', 'completed', true],
    ['running', 'completed', false],
    ['draft', 'completed', false]
  ])('matchesFilter(%s, %s) → %s', (status, filter, expected) => expect(matchesFilter(status, filter)).toBe(expected)))

  // ── filterAndSortTasks (фильтр + сортировка по id, без мутации) ────────────
  describe('filterAndSortTasks', () => {
    const makeTask = (id: number, status: AutomationTaskStatus): AutomationTask =>
      ({ id, status } as AutomationTask)

    const source = [
      makeTask(1, 'draft'),
      makeTask(2, 'running'),
      makeTask(3, 'completed'),
      makeTask(4, 'paused')
    ]

    it.each<[TaskListFilter, TaskListSort, number[]]>([
      ['all', 'newest', [4, 3, 2, 1]],
      ['all', 'oldest', [1, 2, 3, 4]],
      ['active', 'newest', [4, 2]],
      ['draft', 'newest', [1]],
      ['completed', 'newest', [3]]
    ])('filter=%s sort=%s → ids %j', (filter, sort, expectedIds) =>
      expect(filterAndSortTasks(source, filter, sort).map((task) => task.id)).toEqual(expectedIds))

    it('не мутирует исходный массив', () => {
      const before = source.map((task) => task.id)
      filterAndSortTasks(source, 'all', 'oldest')
      expect(source.map((task) => task.id)).toEqual(before)
    })
  })
})
