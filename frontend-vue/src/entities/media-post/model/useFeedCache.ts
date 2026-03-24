import { ref } from 'vue'
import type { Nullable } from '@/shared/lib'

const MAX_SEEN_POSTS = 100
const CACHE_ENABLED_KEY = 'feed_cache_enabled_'
const SEEN_POSTS_KEY = 'feed_seen_posts_'
const MIN_POSTS_KEY = 'feed_min_posts'

export function useFeedCache() {
  const seenPosts = ref<string[]>([])
  const cacheEnabled = ref(false)
  const minPostsPerLoad = ref<Nullable<number>>((() => {
    const saved = localStorage.getItem(MIN_POSTS_KEY)
    return saved ? Number(saved) : null
  })())

  const loadCacheState = (accountId: number) => cacheEnabled.value = localStorage.getItem(`${CACHE_ENABLED_KEY}${String(accountId)}`) === '1'

  const setCacheEnabled = (accountId: number, enabled: boolean) => {
    cacheEnabled.value = enabled
    localStorage.setItem(`${CACHE_ENABLED_KEY}${String(accountId)}`, enabled ? '1' : '0')
  }

  const saveSeenPosts = (accountId: number) => localStorage.setItem(`${SEEN_POSTS_KEY}${String(accountId)}`, JSON.stringify(seenPosts.value))

  const loadSeenPosts = (accountId: number): string[] => {
    try {
      const raw = localStorage.getItem(`${SEEN_POSTS_KEY}${String(accountId)}`)
      return raw ? JSON.parse(raw) as string[] : []
    } catch {
      return []
    }
  }

  const setMinPostsPerLoad = (value: Nullable<number>) => {
    minPostsPerLoad.value = value
    if (value !== null) {
      localStorage.setItem(MIN_POSTS_KEY, String(value))
    } else {
      localStorage.removeItem(MIN_POSTS_KEY)
    }
  }

  const resetSeenPosts = () => seenPosts.value = []

  /** Объединяет новые ID постов с кэшированными, ограничивая размер */
  const mergeSeenPosts = (accountId: number, newIds: string[]) => {
    if (cacheEnabled.value) {
      const cached = loadSeenPosts(accountId)
      seenPosts.value = [...new Set([...cached, ...newIds])].slice(-MAX_SEEN_POSTS)
      saveSeenPosts(accountId)
    } else {
      seenPosts.value = newIds
    }
  }

  /** Добавляет новые ID к текущему списку seen */
  const appendSeenPosts = (accountId: number, newIds: string[]) => {
    const updatedSeen = [...new Set([...seenPosts.value, ...newIds])]
    seenPosts.value = updatedSeen.length > MAX_SEEN_POSTS ? updatedSeen.slice(-MAX_SEEN_POSTS) : updatedSeen
    cacheEnabled.value && saveSeenPosts(accountId)
  }

  /** Возвращает эффективный список seen — seenPosts.value уже синхронизирован с localStorage */
  const getEffectiveSeenPosts = (): string[] => seenPosts.value

  return {
    cacheEnabled,
    minPostsPerLoad,
    loadCacheState,
    setCacheEnabled,
    setMinPostsPerLoad,
    resetSeenPosts,
    mergeSeenPosts,
    appendSeenPosts,
    getEffectiveSeenPosts
  }
}
