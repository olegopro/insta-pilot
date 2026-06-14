import { describe, it, expect } from 'vitest'
import { useSearchQuery } from '@/shared/lib/useSearchQuery'

describe('useSearchQuery', () => it('searchText начальное значение пустая строка', () => {
  const { searchText } = useSearchQuery()
  expect(searchText.value).toBe('')
}))
