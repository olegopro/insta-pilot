import type { QTableColumn } from 'quasar'
import type { Nullable } from '@/shared/lib'

export interface SummaryRowModel {
  accountId: number
  instagramLogin: string
  totalActions: number
  todayActions: number
  errorCountToday: number
  successRate: string
  lastActivityAt: Nullable<string>
  lastError: Nullable<string>
}

export default [
  {
    name: 'instagramLogin',
    label: 'Аккаунт',
    field: (row) => row.instagramLogin,
    align: 'left',
    sortable: true
  },
  {
    name: 'totalActions',
    label: 'Всего',
    field: (row) => row.totalActions,
    align: 'right',
    sortable: true
  },
  {
    name: 'todayActions',
    label: 'Сегодня',
    field: (row) => row.todayActions,
    align: 'right',
    sortable: true
  },
  {
    name: 'errorCountToday',
    label: 'Ошибок',
    field: (row) => row.errorCountToday,
    align: 'right',
    sortable: true
  },
  {
    name: 'successRate',
    label: 'Успех %',
    field: (row) => row.successRate,
    align: 'right',
    sortable: true
  },
  {
    name: 'lastActivityAt',
    label: 'Посл. акт.',
    field: (row) => row.lastActivityAt ?? '—',
    align: 'left'
  }
] satisfies QTableColumn<SummaryRowModel>[]
