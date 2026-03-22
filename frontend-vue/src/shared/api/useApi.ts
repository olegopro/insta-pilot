import { AxiosError, isCancel } from 'axios'
import type { Nullable } from '@/shared/lib'
import { ref, shallowRef } from 'vue'

export function useApi<TData, TArgs = void>(
  requestFunction: (payload: TArgs, signal: AbortSignal) => Promise<TData>
) {
  const loading = ref(false)
  const response = shallowRef<Nullable<TData>>(null)
  const error = shallowRef<Nullable<string>>(null)
  let abortController: Nullable<AbortController> = null

  const execute = async (payload: TArgs): Promise<TData> => {
    abortController?.abort()
    const currentController = new AbortController()
    abortController = currentController
    loading.value = true
    response.value = null
    error.value = null

    try {
      response.value = await requestFunction(payload, currentController.signal)
      return response.value
    } catch (exception: unknown) {
      if (isCancel(exception)) {
        throw exception
      }
      if (exception instanceof AxiosError) {
        error.value = exception.response?.data?.error ?? exception.message
      } else if (exception instanceof Error) {
        error.value = exception.message
      } else {
        error.value = 'Неизвестная ошибка'
      }
      throw exception
    } finally {
      if (abortController === currentController) {
        loading.value = false
      }
    }
  }

  const abort = () => {
    abortController?.abort()
  }

  return { execute, abort, loading, response, error }
}
