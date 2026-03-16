import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { SidebarActivityEntry, ActionType } from './types'
import type { ActivityLogApi } from './apiTypes'
import { summarizeResponse } from './activityLogListDTO'

const MAX_ENTRIES = 200
const SIDEBAR_WIDTH_KEY = 'sidebar_width'

type QuickFilter = 'all' | 'errors' | 'likes' | 'comments'

function mapToSidebarEntry(event: ActivityLogApi): SidebarActivityEntry {
  const summary = summarizeResponse(event.response_summary ?? null)
  const shortMessage = event.error_message ?? (summary || null)

  return {
    id:           event.id,
    accountId:    event.instagram_account_id,
    accountLogin: event.instagram_login ?? '',
    action:       event.action,
    status:       event.status,
    httpCode:     event.http_code,
    shortMessage,
    durationMs:   event.duration_ms,
    createdAt:    event.created_at
  }
}

export const useSidebarActivityStore = defineStore('sidebarActivity', () => {
  const entries = ref<SidebarActivityEntry[]>([])
  const unreadCount = ref(0)
  const isOpen = ref(false)
  const width = ref(Number(localStorage.getItem(SIDEBAR_WIDTH_KEY) ?? 320))
  const quickFilter = ref<QuickFilter>('all')

  const FILTER_ACTIONS: Partial<Record<Exclude<QuickFilter, 'all' | 'errors'>, ActionType[]>> = {
    likes:    ['like'],
    comments: ['comment', 'generate_comment']
  }

  const filteredEntries = computed(() => {
    if (quickFilter.value === 'all') return entries.value
    if (quickFilter.value === 'errors') return entries.value.filter((entry) => entry.status !== 'success')
    const actions = FILTER_ACTIONS[quickFilter.value]
    return actions ? entries.value.filter((entry) => actions.includes(entry.action)) : entries.value
  })

  const addEntry = (event: ActivityLogApi) => {
    const entry = mapToSidebarEntry(event)
    entries.value = [...entries.value, entry].slice(-MAX_ENTRIES)
    !isOpen.value && unreadCount.value++
  }

  const open = () => {
    isOpen.value = true
    unreadCount.value = 0
  }

  const close = () => {
    isOpen.value = false
  }

  const setWidth = (value: number) => {
    width.value = Math.min(600, Math.max(250, value))
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width.value))
  }

  const clearEntries = () => {
    entries.value = []
    unreadCount.value = 0
  }

  return {
    entries,
    filteredEntries,
    unreadCount,
    isOpen,
    width,
    quickFilter,
    addEntry,
    open,
    close,
    setWidth,
    clearEntries
  }
})
