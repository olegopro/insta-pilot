import type { QTableColumn } from 'quasar'
import type { Nullable } from '@/shared/lib'

export interface InstagramAccountRowModel {
  id: number
  instagramLogin: string
  fullName: Nullable<string>
  isActive: boolean
  createdAt: string
}

export default [
  {
    name: 'instagramLogin',
    label: 'Логин',
    field: (row) => row.instagramLogin,
    align: 'left',
    sortable: true
  },
  {
    name: 'fullName',
    label: 'Имя',
    field: (row) => row.fullName ?? '—',
    align: 'left',
    sortable: true
  },
  {
    name: 'isActive',
    label: 'Статус',
    field: (row) => row.isActive,
    align: 'center'
  },
  {
    name: 'createdAt',
    label: 'Добавлен',
    field: (row) => row.createdAt,
    align: 'left',
    sortable: true,
    format: (val: string) => new Date(val).toLocaleDateString('ru-RU')
  },
  {
    name: 'actions',
    label: 'Действия',
    field: (row) => row.id,
    align: 'center'
  }
] satisfies QTableColumn<InstagramAccountRowModel>[]
