import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { ActivityLogApi } from '@/entities/activity-log/model/apiTypes'
import { useSidebarActivityStore } from '@/entities/activity-log/model/sidebarActivityStore'

const makeLogApi = (overrides: Partial<ActivityLogApi> = {}): ActivityLogApi => ({
  id:                    1,
  instagram_account_id:  10,
  instagram_login:       'user1',
  user_id:               1,
  action:                'like',
  status:                'success',
  http_code:             200,
  endpoint:              '/like',
  request_payload:       null,
  response_summary:      null,
  error_message:         null,
  error_code:            null,
  duration_ms:           100,
  created_at:            '2026-01-01T10:00:00Z',
  ...overrides
})

describe('sidebarActivityStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('addEntry добавляет запись в конец списка', () => {
    const store = useSidebarActivityStore()
    store.addEntry(makeLogApi({ id: 1 }))
    store.addEntry(makeLogApi({ id: 2 }))

    expect(store.entries).toHaveLength(2)
    expect(store.entries[1]!.id).toBe(2)
  })

  it('addEntry увеличивает unreadCount если сайдбар закрыт', () => {
    const store = useSidebarActivityStore()
    store.addEntry(makeLogApi())
    store.addEntry(makeLogApi({ id: 2 }))

    expect(store.unreadCount).toBe(2)
  })

  it('open сбрасывает unreadCount', () => {
    const store = useSidebarActivityStore()
    store.addEntry(makeLogApi())
    store.addEntry(makeLogApi({ id: 2 }))

    store.open()

    expect(store.unreadCount).toBe(0)
    expect(store.isOpen).toBe(true)
  })

  it('filteredEntries возвращает только ошибки при quickFilter = errors', () => {
    const store = useSidebarActivityStore()
    store.addEntry(makeLogApi({ id: 1, status: 'success' }))
    store.addEntry(makeLogApi({ id: 2, status: 'error' }))

    store.quickFilter = 'errors'

    expect(store.filteredEntries).toHaveLength(1)
    expect(store.filteredEntries[0]!.id).toBe(2)
  })

  it('filteredEntries фильтрует по типу действия likes', () => {
    const store = useSidebarActivityStore()
    store.addEntry(makeLogApi({ id: 1, action: 'like' }))
    store.addEntry(makeLogApi({ id: 2, action: 'comment' }))

    store.quickFilter = 'likes'

    expect(store.filteredEntries).toHaveLength(1)
    expect(store.filteredEntries[0]!.action).toBe('like')
  })

  it('setWidth ограничивает ширину диапазоном 250–600', () => {
    const store = useSidebarActivityStore()

    store.setWidth(100)
    expect(store.width).toBe(250)

    store.setWidth(800)
    expect(store.width).toBe(600)

    store.setWidth(400)
    expect(store.width).toBe(400)
  })

  it('ширина сохраняется в localStorage', () => {
    const store = useSidebarActivityStore()
    store.setWidth(380)

    expect(localStorage.getItem('sidebar_width')).toBe('380')
  })

  it('clearEntries очищает entries и unreadCount', () => {
    const store = useSidebarActivityStore()
    store.addEntry(makeLogApi())
    store.clearEntries()

    expect(store.entries).toHaveLength(0)
    expect(store.unreadCount).toBe(0)
  })
})
