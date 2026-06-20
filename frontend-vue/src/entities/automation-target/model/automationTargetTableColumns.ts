import type { QTableColumn } from 'quasar'
import type { Nullable } from '@/shared/lib'
import { formatCount } from '@/shared/lib'
import type { AutomationTargetStatus } from '@/entities/automation-target/model/types'

export interface AutomationTargetRowModel {
  id: number
  username: string
  fullName: Nullable<string>
  followerCount: Nullable<number>
  followingCount: Nullable<number>
  likesAvg: Nullable<number>
  lastPostAgeDays: Nullable<number>
  isPrivate: boolean
  isVerified: boolean
  status: AutomationTargetStatus
}

const formatNullableCount = (value: Nullable<number>): string =>
  value === null ? '—' : formatCount(value)

export default [
  {
    name: 'username',
    label: 'Аккаунт',
    field: (row) => row.username,
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
    name: 'followerCount',
    label: 'Подписчики',
    field: (row) => row.followerCount,
    align: 'right',
    sortable: true,
    format: (val: Nullable<number>) => formatNullableCount(val)
  },
  {
    name: 'followingCount',
    label: 'Подписки',
    field: (row) => row.followingCount,
    align: 'right',
    sortable: true,
    format: (val: Nullable<number>) => formatNullableCount(val)
  },
  {
    name: 'likesAvg',
    label: 'Ср. лайков',
    field: (row) => row.likesAvg,
    align: 'right',
    sortable: true,
    format: (val: Nullable<number>) => formatNullableCount(val)
  },
  {
    name: 'lastPostAgeDays',
    label: 'Последний пост',
    field: (row) => row.lastPostAgeDays,
    align: 'right',
    sortable: true,
    format: (val: Nullable<number>) => (val === null ? '—' : `${String(val)} дн.`)
  },
  {
    name: 'status',
    label: 'Статус',
    field: (row) => row.status,
    align: 'center'
  },
  {
    name: 'actions',
    label: 'Действия',
    field: (row) => row.id,
    align: 'center'
  }
] satisfies QTableColumn<AutomationTargetRowModel>[]
