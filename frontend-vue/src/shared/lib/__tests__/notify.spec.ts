import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('quasar', () => ({
  Notify: {
    create: vi.fn()
  }
}))

import { Notify } from 'quasar'
import { notifySuccess, notifyError } from '@/shared/lib/notify'

describe('notifySuccess', () => {
  beforeEach(() => vi.clearAllMocks())

  it('вызывает Notify.create с type=positive', () => {
    notifySuccess('Успешно сохранено')
    expect(Notify.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'positive',
      message: 'Успешно сохранено'
    }))
  })

  it('передаёт position=top-right', () => {
    notifySuccess('OK')
    expect(Notify.create).toHaveBeenCalledWith(expect.objectContaining({
      position: 'top-right'
    }))
  })
})

describe('notifyError', () => {
  beforeEach(() => vi.clearAllMocks())

  it('вызывает Notify.create с type=negative и сообщением', () => {
    notifyError('Произошла ошибка')
    expect(Notify.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'negative',
      message: 'Произошла ошибка'
    }))
  })
})
