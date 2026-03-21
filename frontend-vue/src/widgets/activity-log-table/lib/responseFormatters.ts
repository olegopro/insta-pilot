import type { Nullable } from '@/shared/lib'
import type { JsonObj, TabMode } from '../model/types'

export const NESTED_REQUEST_KEYS = ['python_request', 'instagram_request', 'llm_request']
export const NESTED_RESPONSE_KEYS = ['python_response', 'instagram_response', 'llm_response']

export function extractKey(obj: Nullable<JsonObj>, key: string): Nullable<JsonObj> {
  if (!obj) return null
  const val = obj[key]
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as JsonObj) : null
}

export function withoutKeys(obj: Nullable<JsonObj>, keys: string[]): Nullable<JsonObj> {
  if (!obj) return null
  const result = Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)))
  return Object.keys(result).length > 0 ? result : null
}

/** Оставляет только скалярные значения (не объекты / массивы) */
export function compactify(obj: Nullable<JsonObj>): Nullable<JsonObj> {
  if (!obj) return null
  const result = Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value === null || typeof value !== 'object')
  )
  return Object.keys(result).length > 0 ? result : null
}

export function hasNestedData(obj: Nullable<JsonObj>): boolean {
  if (!obj) return false
  return Object.values(obj).some((value) => value !== null && typeof value === 'object')
}

/** Формирует tooltip для полей *_preview */
export function previewTooltip(obj: Nullable<JsonObj>): Nullable<string> {
  if (!obj) return null
  const previewKeys = Object.keys(obj).filter((key) => key.endsWith('_preview'))
  if (previewKeys.length === 0) return null

  const parts = previewKeys.map((key) => {
    const arr = obj[key]
    const count = Array.isArray(arr) ? String(arr.length) : '0'
    return `${key}: первые ${count} эл.`
  })
  return `Сокращённый preview. ${parts.join(', ')}. Полные данные не хранятся в логе.`
}

export function display(obj: Nullable<JsonObj>, tab: TabMode): Nullable<JsonObj> {
  return tab === 'compact' ? compactify(obj) : obj
}
