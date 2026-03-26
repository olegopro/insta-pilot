import { describe, it, expect } from 'vitest'
import { requiredField, checkEmail } from '@/shared/lib/validators'

describe('requiredField', () => {
  it('возвращает true для непустой строки', () => expect(requiredField('hello')).toBe(true))

  it('возвращает сообщение об ошибке для пустой строки', () => expect(requiredField('')).toBe('Обязательное поле'))
})

describe('checkEmail', () => {
  it('возвращает true для валидного email', () => expect(checkEmail('user@example.com')).toBe(true))

  it('возвращает сообщение об ошибке для невалидного email', () => {
    expect(checkEmail('not-an-email')).toBe('Некорректный email')
    expect(checkEmail('missing@dot')).toBe('Некорректный email')
  })

  it('возвращает сообщение об ошибке для пустой строки', () => expect(checkEmail('')).toBe('Некорректный email'))

  it('функция совместима с форматом Quasar rules (возвращает true | string)', () => {
    const validResult = checkEmail('test@test.com')
    const invalidResult = checkEmail('bad')
    expect(typeof validResult === 'boolean' || typeof validResult === 'string').toBe(true)
    expect(typeof invalidResult === 'string').toBe(true)
  })
})
