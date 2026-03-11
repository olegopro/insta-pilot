import { AxiosError } from 'axios'
import type { Nullable } from '@/shared/lib'
import { ref, shallowRef } from 'vue'

export function useApi<TData, TArgs = void>(
  requestFunction: (payload: TArgs) => Promise<TData>
) {
  const loading = ref(false)
  const data = shallowRef<Nullable<TData>>(null)
  const error = shallowRef<Nullable<string>>(null)

  const execute = async (payload: TArgs) => {
    loading.value = true
    data.value = null
    error.value = null

    try {
      data.value = await requestFunction(payload)
    } catch (exception: unknown) {
      if (exception instanceof AxiosError) {
        error.value = exception.response?.data?.error ?? exception.message
      } else if (exception instanceof Error) {
        error.value = exception.message
      } else {
        error.value = 'Неизвестная ошибка'
      }
      throw exception
    } finally {
      loading.value = false
    }
  }

  return { execute, loading, data, error }
}
