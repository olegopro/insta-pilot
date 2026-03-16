import type { QTableColumn } from 'quasar'
import type { Nullable } from '@/shared/lib'
import type { ActionType, ActionStatus } from './types'

export interface ActivityLogRowModel {
  id: number
  action: ActionType
  actionLabel: string
  actionColor: string
  status: ActionStatus
  statusIcon: string
  statusColor: string
  statusLabel: string
  httpCode: Nullable<number>
  httpCodeColor: string
  endpoint: Nullable<string>
  errorMessage: Nullable<string>
  errorCode: Nullable<string>
  durationMs: Nullable<number>
  durationFormatted: string
  durationColor: string
  responseSummaryText: string
  requestPayload: Nullable<Record<string, unknown>>
  responseSummary: Nullable<Record<string, unknown>>
  createdAt: string
  timeFormatted: string
}

export default [
  {
    name: 'time',
    label: 'Время',
    field: (row) => row.timeFormatted,
    align: 'left',
    style: 'width: 80px'
  },
  {
    name: 'action',
    label: 'Действие',
    field: (row) => row.actionLabel,
    align: 'left',
    style: 'width: 140px'
  },
  {
    name: 'status',
    label: 'Статус',
    field: (row) => row.statusLabel,
    align: 'left',
    style: 'width: 120px'
  },
  {
    name: 'httpCode',
    label: 'Код',
    field: (row) => row.httpCode,
    align: 'center',
    style: 'width: 60px'
  },
  {
    name: 'endpoint',
    label: 'Endpoint',
    field: (row) => row.endpoint ?? '—',
    align: 'left'
  },
  {
    name: 'duration',
    label: 'Длит.',
    field: (row) => row.durationFormatted,
    align: 'right',
    style: 'width: 80px'
  }
] satisfies QTableColumn<ActivityLogRowModel>[]
