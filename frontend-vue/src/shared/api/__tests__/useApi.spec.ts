import { describe, it, expect, vi } from 'vitest'
import { AxiosError } from 'axios'
import { useApi } from '@/shared/api'

describe('useApi', () => {
  it('loading становится true во время запроса, false после завершения', async () => {
    let resolveFn!: (value: string) => void
    const pending = new Promise<string>((resolve) => resolveFn = resolve)
    const { execute, loading } = useApi(() => pending)

    const promise = execute()
    expect(loading.value).toBe(true)

    resolveFn('done')
    await promise
    expect(loading.value).toBe(false)
  })

  it('response содержит результат после успешного запроса', async () => {
    const mockData = { id: 1, name: 'Test' }
    const { execute, response } = useApi(() => Promise.resolve(mockData))

    const result = await execute()
    expect(response.value).toEqual(mockData)
    expect(result).toEqual(mockData)
  })

  const axiosErrorWithData = new AxiosError('Request failed')
  axiosErrorWithData.response = { data: { error: 'Неверный пароль' } } as NonNullable<typeof axiosErrorWithData.response>

  const axiosErrorNoData = new AxiosError('Сетевой сбой')

  it.each([
    [axiosErrorWithData, 'Неверный пароль'],
    [axiosErrorNoData, 'Сетевой сбой'],
    [new Error('Ошибка сети'), 'Ошибка сети'],
    ['строка', 'Неизвестная ошибка']
  ])('error маппит исключение %#: %o → текст', async (exception, expectedError) => {
    const { execute, error } = useApi(() => Promise.reject(exception))

    await expect(execute()).rejects.toThrow()
    expect(error.value).toBe(expectedError)
  })

  it('loading становится false после ошибки', async () => {
    const { execute, loading } = useApi(() => Promise.reject(new Error('fail')))

    await expect(execute()).rejects.toThrow()
    expect(loading.value).toBe(false)
  })

  it('повторный execute сбрасывает response и error перед запросом', async () => {
    const requestFn = vi.fn<() => Promise<string>>()
    requestFn.mockResolvedValueOnce('first').mockRejectedValueOnce(new Error('fail'))

    const { execute, response, error } = useApi(requestFn)

    await execute()
    expect(response.value).toBe('first')

    await expect(execute()).rejects.toThrow()
    expect(response.value).toBeNull()
    expect(error.value).toBe('fail')
  })
})
