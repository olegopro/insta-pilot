import type { Nullable } from 'src/shared/lib'
import { ref, shallowRef } from 'vue'

export function useApi<TData, TArgs = void>(
  fn: (args: TArgs) => Promise<TData>
) {
  const loading = ref(false)
  const data = shallowRef<Nullable<TData>>(null)

  const execute = async (args: TArgs) => {
    loading.value = true

    try {
      data.value = await fn(args)
    } finally {
      loading.value = false
    }
  }

  return { execute, loading, data }
}
