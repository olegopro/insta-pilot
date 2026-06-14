import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('quasar', () => ({
  Notify: {
    create: vi.fn()
  }
}))

import { Notify } from 'quasar'
import { notifySuccess, notifyError } from '@/shared/lib/notify'

describe('notify', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    [notifySuccess, 'positive', 'Успешно сохранено'],
    [notifyError, 'negative', 'Произошла ошибка']
  ])('%o вызывает Notify.create с type=%s, сообщением и position=top-right', (fn, type, message) => {
    fn(message)
    expect(Notify.create).toHaveBeenCalledWith(expect.objectContaining({
      type,
      message,
      position: 'top-right'
    }))
  })
})
