import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import type { SidebarActivityEntry, ActionType, QuickFilter } from './types'
import type { ActivityLogApi } from './apiTypes'
import sidebarActivityDTO from './sidebarActivityDTO'

const MAX_ENTRIES = 200
const SIDEBAR_WIDTH_KEY = 'sidebar_width'
const SIDEBAR_ENTRIES_KEY = 'sidebar_entries'
const SIDEBAR_UNREAD_KEY = 'sidebar_unread'

const loadEntries = (): SidebarActivityEntry[] => {
  try { return JSON.parse(localStorage.getItem(SIDEBAR_ENTRIES_KEY) ?? '[]') }
  catch { return [] }
}

export const useSidebarActivityStore = defineStore('sidebarActivity', () => {
  const entries = ref<SidebarActivityEntry[]>(loadEntries())
  const unreadCount = ref(Number(localStorage.getItem(SIDEBAR_UNREAD_KEY) ?? 0))
  const isOpen = ref(false)
  const width = ref(Number(localStorage.getItem(SIDEBAR_WIDTH_KEY) ?? 320))
  const quickFilter = ref<QuickFilter>('all')

  watch(entries, (value) => localStorage.setItem(SIDEBAR_ENTRIES_KEY, JSON.stringify(value)))
  watch(unreadCount, (value) => localStorage.setItem(SIDEBAR_UNREAD_KEY, String(value)))

  const FILTER_ACTIONS: Partial<Record<Exclude<QuickFilter, 'all' | 'errors'>, ActionType[]>> = {
    likes:    ['like'],
    comments: ['comment', 'generate_comment', 'fetch_comments']
  }

  const filteredEntries = computed(() => {
    if (quickFilter.value === 'all') return entries.value
    if (quickFilter.value === 'errors') return entries.value.filter((entry) => entry.status !== 'success')
    const actions = FILTER_ACTIONS[quickFilter.value]
    return actions ? entries.value.filter((entry) => actions.includes(entry.action)) : entries.value
  })

  const addEntry = (event: ActivityLogApi) => {
    const entry = sidebarActivityDTO.toLocal(event)
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
