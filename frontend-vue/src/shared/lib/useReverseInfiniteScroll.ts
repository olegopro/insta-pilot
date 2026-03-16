import { ref, nextTick } from 'vue'

export function useReverseInfiniteScroll() {
  const isLoadingOlder = ref(false)

  const onScroll = async (loadOlderFn: () => Promise<void>) => {
    if (isLoadingOlder.value) return

    if (window.scrollY < 100) {
      isLoadingOlder.value = true
      const prevScrollHeight = document.documentElement.scrollHeight
      const prevScrollTop = window.scrollY

      await loadOlderFn()

      await nextTick()
      const addedHeight = document.documentElement.scrollHeight - prevScrollHeight

      if (addedHeight > 0) {
        window.scrollTo({ top: prevScrollTop + addedHeight, behavior: 'instant' })
      }

      isLoadingOlder.value = false
    }
  }

  return { isLoadingOlder, onScroll }
}
