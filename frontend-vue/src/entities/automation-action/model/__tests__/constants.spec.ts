import { describe, it, expect } from 'vitest'
import { getActionTypeLabel } from '@/entities/automation-action/model/constants'

describe('getActionTypeLabel', () => it.each([
  ['like', 'Лайк'],
  ['comment', 'Комментарий'],
  ['follow', 'Подписка'],
  ['unfollow', 'Отписка'],
  ['parsing', null],
  [null, null],
  ['unknown', null],
  ['', null]
])('getActionTypeLabel(%s) → %s', (input, expected) => expect(getActionTypeLabel(input)).toBe(expected)))
