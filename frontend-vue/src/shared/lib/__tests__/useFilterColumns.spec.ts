import { describe, it, expect } from 'vitest'
import type { QTableColumn } from 'quasar'
import { useFilterColumns } from '@/shared/lib/useFilterColumns'

const makeColumns = (): QTableColumn[] => [
  { name: 'id',     label: 'ID',     field: 'id',     align: 'left' },
  { name: 'name',   label: 'Имя',    field: 'name',   align: 'left' },
  { name: 'status', label: 'Статус', field: 'status', align: 'left' }
]

describe('useFilterColumns', () => {
  it('возвращает columns и columnsVisibleNames', () => {
    const { columns, columnsVisibleNames } = useFilterColumns(makeColumns())
    expect(columns.value).toHaveLength(3)
    expect(columnsVisibleNames.value).toHaveLength(3)
  })

  it('columnsVisibleNames содержит name каждой колонки', () => {
    const { columnsVisibleNames } = useFilterColumns(makeColumns())
    expect(columnsVisibleNames.value).toEqual(['id', 'name', 'status'])
  })

  it('columnsVisibleNames реактивен при изменении', () => {
    const { columnsVisibleNames } = useFilterColumns(makeColumns())
    columnsVisibleNames.value = ['id', 'status']
    expect(columnsVisibleNames.value).toEqual(['id', 'status'])
    expect(columnsVisibleNames.value).not.toContain('name')
  })
})
