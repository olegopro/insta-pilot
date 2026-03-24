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

    await execute()
    expect(response.value).toEqual(mockData)
  })

  it('error содержит сообщение при AxiosError', async () => {
    const axiosError = new AxiosError('Request failed')
    axiosError.response = { data: { error: 'Неверный пароль' } } as NonNullable<typeof axiosError.response>

    const { execute, error } = useApi(() => Promise.reject(axiosError))

    await expect(execute()).rejects.toThrow()
    expect(error.value).toBe('Неверный пароль')
  })

  it('error содержит message при обычной Error', async () => {
    const { execute, error } = useApi(() => Promise.reject(new Error('Ошибка сети')))

    await expect(execute()).rejects.toThrow()
    expect(error.value).toBe('Ошибка сети')
  })

  it('error = "Неизвестная ошибка" при нестандартном исключении', async () => {
    const { execute, error } = useApi(() => Promise.reject('строка'))

    await expect(execute()).rejects.toThrow()
    expect(error.value).toBe('Неизвестная ошибка')
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
