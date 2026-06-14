import { describe, it, expect } from 'vitest'
import { requiredField, checkEmail } from '@/shared/lib/validators'

describe('requiredField', () => {
  it('возвращает true для непустой строки', () => expect(requiredField('hello')).toBe(true))

  it('возвращает сообщение об ошибке для пустой строки', () => expect(requiredField('')).toBe('Обязательное поле'))
})

describe('checkEmail', () => it.each([
  ['user@example.com', true],
  ['not-an-email', 'Некорректный email'],
  ['missing@dot', 'Некорректный email'],
  ['', 'Некорректный email']
])('checkEmail(%s) === %s', (input, expected) => expect(checkEmail(input)).toBe(expected)))
