import type { Nullable } from './types'

export const formatCount = (count: number): string => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return String(count)
}

export const formatDate = (iso: string): string => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export const formatTimeHMS = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return iso
  }
}

export const formatTimeHM = (iso: Nullable<string>): Nullable<string> => {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export const formatDuration = (durationMs: Nullable<number>): { text: string; color: string } => {
  if (durationMs === null) return { text: '—', color: '' }
  if (durationMs >= 3000) return { text: `${(durationMs / 1000).toFixed(1)}s`, color: 'negative' }
  if (durationMs >= 1000) return { text: `${(durationMs / 1000).toFixed(1)}s`, color: 'warning' }
  return { text: `${String(durationMs)}ms`, color: '' }
}

export const formatRelativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${String(diffMin)} мин.`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${String(diffH)} ч.`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${String(diffD)} д.`
  const diffW = Math.floor(diffD / 7)
  if (diffW < 5) return `${String(diffW)} нед.`
  return formatDate(iso)
}

export const formatDateRu = (date: string): string => {
  if (!date) return ''
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`
}
