import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import { echo } from '@/shared/lib'
import { useActivityLogStore } from '@/entities/activity-log'
import type { ActivityLogApi } from '@/entities/activity-log'

export function useActivityLive(accountId: Ref<number>) {
  const store = useActivityLogStore()
  const isConnected = ref(false)
  let channelName = ''

  const subscribe = () => {
    if (!accountId.value) return
    channelName = `account-activity.${String(accountId.value)}`
    echo.private(channelName)
      .listen(
        '.ActivityLogCreated',
        (event: ActivityLogApi) => store.appendNewLog(event)
      )
      .subscribed(() => isConnected.value = true)
  }

  const unsubscribe = () => {
    channelName && echo.leave(channelName)
    isConnected.value = false
    channelName = ''
  }

  watch(accountId, () => {
    unsubscribe()
    subscribe()
  })

  onMounted(subscribe)
  onBeforeUnmount(unsubscribe)

  return { isConnected }
}
