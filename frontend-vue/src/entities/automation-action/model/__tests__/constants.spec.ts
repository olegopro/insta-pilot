import { describe, it, expect } from 'vitest'
import { getActionTypeLabel, getActionTypeIcon } from '@/entities/automation-action/model/constants'

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

describe('getActionTypeIcon', () => it.each([
  ['like', 'favorite'],
  ['comment', 'chat_bubble'],
  ['follow', 'person_add'],
  ['unfollow', 'person_remove']
] as const)('getActionTypeIcon(%s) → %s', (input, expected) => expect(getActionTypeIcon(input)).toBe(expected)))
