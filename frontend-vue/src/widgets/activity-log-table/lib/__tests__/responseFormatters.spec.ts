import { describe, it, expect } from 'vitest'
import {
  extractKey,
  compactify,
  hasNestedData,
  previewTooltip,
  display
} from '@/widgets/activity-log-table/lib/responseFormatters'

describe('extractKey', () => {
  it('извлекает вложенный объект по ключу', () => {
    const obj = { python_request: { url: '/feed', method: 'GET' }, status: 200 }
    const result = extractKey(obj, 'python_request')
    expect(result).toEqual({ url: '/feed', method: 'GET' })
  })

  it('возвращает null если ключ не является объектом', () => expect(extractKey({ status: 200 }, 'status')).toBeNull())

  it('возвращает null для null входа', () => expect(extractKey(null, 'any')).toBeNull())

  it('возвращает null для массива', () => {
    const obj = { items: [1, 2, 3] }
    expect(extractKey(obj, 'items')).toBeNull()
  })
})

describe('compactify', () => {
  it('оставляет только скалярные значения', () => {
    const obj = { id: 1, name: 'test', nested: { a: 1 }, arr: [1, 2], nullVal: null }
    const result = compactify(obj)
    expect(result).toEqual({ id: 1, name: 'test', nullVal: null })
  })

  it('возвращает null для null входа', () => expect(compactify(null)).toBeNull())

  it('возвращает null если все поля — объекты', () => {
    const obj = { nested: { a: 1 }, arr: [1, 2] }
    expect(compactify(obj)).toBeNull()
  })
})

describe('hasNestedData', () => {
  it('возвращает true если есть вложенные объекты', () => expect(hasNestedData({ a: 1, b: { c: 2 } })).toBe(true))

  it('возвращает true если есть массивы', () => expect(hasNestedData({ items: [1, 2] })).toBe(true))

  it('возвращает false для плоского объекта', () => expect(hasNestedData({ a: 1, b: 'text', c: null })).toBe(false))

  it('возвращает false для null', () => expect(hasNestedData(null)).toBe(false))
})

describe('previewTooltip', () => {
  it('формирует tooltip для *_preview полей', () => {
    const obj = { data_preview: ['a', 'b', 'c'], status: 200 }
    const result = previewTooltip(obj)
    expect(result).toContain('data_preview')
    expect(result).toContain('3')
    expect(result).toContain('Сокращённый preview')
  })

  it('возвращает null если нет _preview полей', () => expect(previewTooltip({ status: 200, items: [1] })).toBeNull())

  it('возвращает null для null', () => expect(previewTooltip(null)).toBeNull())
})

describe('display', () => {
  it('compact → возвращает только скалярные поля', () => {
    const obj = { id: 1, nested: { x: 2 } }
    const result = display(obj, 'compact')
    expect(result).toEqual({ id: 1 })
  })

  it('full → возвращает весь объект', () => {
    const obj = { id: 1, nested: { x: 2 } }
    const result = display(obj, 'full')
    expect(result).toEqual(obj)
  })

  it('возвращает null для null', () => expect(display(null, 'compact')).toBeNull())
})
