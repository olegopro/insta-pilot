import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/boot/axios', () => ({
  api: {
    post: vi.fn()
  }
}))

let listenHandler: ((event: Record<string, unknown>) => void) | null = null

const mockChannel = {
  listen: vi.fn((_, handler: (event: Record<string, unknown>) => void) => {
    listenHandler = handler
    return mockChannel
  })
}

vi.mock('@/shared/lib', () => ({
  echo: {
    private: vi.fn(() => mockChannel),
    leave:   vi.fn()
  },
  Nullable: undefined
}))

import { api } from '@/boot/axios'
import { echo } from '@/shared/lib'
import { useCommentGeneration } from '@/features/generate-comment/lib/useCommentGeneration'

const makeJobResponse = (jobId = 'job-123') => ({
  data: { success: true, data: { job_id: jobId } }
})

describe('useCommentGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listenHandler = null
  })

  it('step изначально idle', () => {
    const { step } = useCommentGeneration()
    expect(step.value).toBe('idle')
  })

  it('generate() устанавливает step=starting и подписывается на канал', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(makeJobResponse())
    const { step, generate } = useCommentGeneration()

    await generate('https://cdn.example.com/img.jpg')

    expect(step.value).toBe('starting')
    expect(echo.private).toHaveBeenCalledWith('comment-generation.job-123')
  })

  it('событие downloading обновляет step', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(makeJobResponse())
    const { step, generate } = useCommentGeneration()
    await generate('https://cdn.example.com/img.jpg')

    listenHandler?.({ step: 'downloading' })
    expect(step.value).toBe('downloading')
  })

  it('событие analyzing обновляет step', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(makeJobResponse())
    const { step, generate } = useCommentGeneration()
    await generate('https://cdn.example.com/img.jpg')

    listenHandler?.({ step: 'analyzing' })
    expect(step.value).toBe('analyzing')
  })

  it('событие completed обновляет step и generatedComment', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(makeJobResponse())
    const { step, generatedComment, generate } = useCommentGeneration()
    await generate('https://cdn.example.com/img.jpg')

    listenHandler?.({ step: 'completed', comment: 'Great photo!' })

    expect(step.value).toBe('completed')
    expect(generatedComment.value).toBe('Great photo!')
  })

  it('событие failed обновляет step и error', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(makeJobResponse())
    const { step, error, generate } = useCommentGeneration()
    await generate('https://cdn.example.com/img.jpg')

    listenHandler?.({ step: 'failed', error: 'LLM timeout' })

    expect(step.value).toBe('failed')
    expect(error.value).toBe('LLM timeout')
  })

  it('при ошибке POST step=failed и error заполнен', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error'))
    const { step, error, generate } = useCommentGeneration()

    await generate('https://cdn.example.com/img.jpg')

    expect(step.value).toBe('failed')
    expect(error.value).toBe('Ошибка запроса генерации')
  })

  it('cleanup() отписывается от канала через echo.leave', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(makeJobResponse())
    const { generate, cleanup } = useCommentGeneration()
    await generate('https://cdn.example.com/img.jpg')

    cleanup()

    expect(echo.leave).toHaveBeenCalledWith('comment-generation.job-123')
  })

  it('reset() сбрасывает step в idle', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(makeJobResponse())
    const { step, generate, reset } = useCommentGeneration()
    await generate('https://cdn.example.com/img.jpg')

    reset()

    expect(step.value).toBe('idle')
  })
})
