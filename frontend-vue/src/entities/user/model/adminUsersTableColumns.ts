import type { QTableColumn } from 'quasar'

export interface UserRowModel {
  id: number
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

export default [
  {
    name: 'name',
    label: 'Имя',
    field: (row) => row.name,
    align: 'left',
    sortable: true
  },
  {
    name: 'email',
    label: 'Email',
    field: (row) => row.email,
    align: 'left',
    sortable: true
  },
  {
    name: 'role',
    label: 'Роль',
    field: (row) => row.role,
    align: 'center',
    style: 'min-width: 140px'
  },
  {
    name: 'isActive',
    label: 'Активен',
    field: (row) => row.isActive,
    align: 'center'
  },
  {
    name: 'createdAt',
    label: 'Зарегистрирован',
    field: (row) => row.createdAt,
    align: 'left',
    sortable: true,
    format: (val: string) => new Date(val).toLocaleDateString('ru-RU')
  }
] satisfies QTableColumn<UserRowModel>[]
