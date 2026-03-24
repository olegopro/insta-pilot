import { ref } from 'vue'
import { echo } from '@/shared/lib'
import { useAuthStore } from '@/entities/user'
import { useSidebarActivityStore } from '@/entities/activity-log'
import type { ActivityLogApi } from '@/entities/activity-log'

export function useGlobalActivityLive() {
  const authStore = useAuthStore()
  const sidebarStore = useSidebarActivityStore()
  const isConnected = ref(false)
  let channelName = ''

  const subscribe = () => {
    const userId = authStore.user?.id
    if (!userId) return

    channelName = `activity-global.${String(userId)}`
    echo.private(channelName)
      .listen(
        '.ActivityLogCreated',
        (event: ActivityLogApi) => sidebarStore.addEntry(event)
      )
      .subscribed(() => isConnected.value = true)
  }

  const unsubscribe = () => {
    channelName && echo.leave(channelName)
    isConnected.value = false
    channelName = ''
  }

  return { isConnected, subscribe, unsubscribe }
}
