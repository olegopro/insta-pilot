import { describe, it, expect } from 'vitest'
import { useModal } from '@/shared/lib/useModal'

describe('useModal', () => {
  it('isVisible изначально false', () => {
    const modal = useModal()
    expect(modal.isVisible).toBe(false)
  })

  it('open() устанавливает isVisible = true', () => {
    const modal = useModal()
    modal.open()
    expect(modal.isVisible).toBe(true)
  })

  it('close() устанавливает isVisible = false', () => {
    const modal = useModal()
    modal.open()
    modal.close()
    expect(modal.isVisible).toBe(false)
  })

  it('каждый вызов useModal возвращает независимый экземпляр', () => {
    const modal1 = useModal()
    const modal2 = useModal()
    modal1.open()
    expect(modal1.isVisible).toBe(true)
    expect(modal2.isVisible).toBe(false)
  })
})
