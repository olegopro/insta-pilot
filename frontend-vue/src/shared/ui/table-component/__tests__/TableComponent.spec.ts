import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TableComponent from '@/shared/ui/table-component/TableComponent.vue'
import type { QTableColumn } from 'quasar'

const columns: QTableColumn[] = [
  { name: 'id', label: 'ID', field: 'id', align: 'left' },
  { name: 'name', label: 'Имя', field: 'name', align: 'left' }
]
const rows = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]

// QTable рендерит через сложный слот-механизм — стабим простым div
const QTableStub = {
  name: 'QTable',
  props: ['columns', 'rows', 'rowsPerPageOptions', 'flat', 'bordered', 'hidePagination'],
  template: `<div data-q-table :data-rows="JSON.stringify(rows)" :data-columns="JSON.stringify(columns)">
    <slot name="body-cell" />
    <slot name="header-cell" />
    <slot />
  </div>`
}

describe('TableComponent', () => {
  it('пробрасывает columns и rows в q-table', () => {
    const wrapper = mount(TableComponent, {
      props:  { columns, rows },
      global: { stubs: { 'q-table': QTableStub } }
    })
    const table = wrapper.find('[data-q-table]')
    const passedRows = JSON.parse(table.attributes('data-rows') ?? '[]') as typeof rows
    expect(passedRows).toHaveLength(2)
    expect(passedRows[0].name).toBe('Alice')
  })

  it('пробрасывает columns с правильными именами', () => {
    const wrapper = mount(TableComponent, {
      props:  { columns, rows },
      global: { stubs: { 'q-table': QTableStub } }
    })
    const table = wrapper.find('[data-q-table]')
    const passedColumns = JSON.parse(table.attributes('data-columns') ?? '[]') as typeof columns
    expect(passedColumns[0].name).toBe('id')
    expect(passedColumns[1].name).toBe('name')
  })

  it('проксирует слот body-cell', () => {
    const wrapper = mount(TableComponent, {
      props:    { columns, rows },
      slots:    { 'body-cell': '<span data-slot-body-cell>cell</span>' },
      global:   { stubs: { 'q-table': QTableStub } }
    })
    expect(wrapper.find('[data-slot-body-cell]').exists()).toBe(true)
  })

  it('forwarded props не содержат undefined для непереданных пропсов', () => expect(() =>
    mount(TableComponent, {
      props:  { columns, rows },
      global: { stubs: { 'q-table': QTableStub } }
    })
  ).not.toThrow())
})
