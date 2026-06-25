import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type * as VueRuntime from 'vue'
import type { AutomationTaskProgressEvent } from '@/entities/automation-task'

// onBeforeUnmount вызывается вне компонента — глушим, чтобы не было предупреждения Vue.
vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof VueRuntime>()
  return { ...actual, onBeforeUnmount: vi.fn() }
})

let listenHandler: ((event: AutomationTaskProgressEvent) => void) | null = null

const mockChannel = {
  listen: vi.fn((_eventName: string, handler: (event: AutomationTaskProgressEvent) => void) => {
    listenHandler = handler
    return mockChannel
  })
}

vi.mock('@/shared/lib', () => ({
  echo: {
    private: vi.fn(() => mockChannel),
    leave:   vi.fn()
  }
}))

import { echo } from '@/shared/lib'
import { useParseProgress } from '@/features/automation-task-live/lib/useParseProgress'

const TASK_ID = 42
const POLL_INTERVAL_MS = 2500
// Старый сломанный бюджет был 8 × 2500 = 20с — парс реально дольше.
const OLD_BUDGET_MS = 20_000

const completedEvent: AutomationTaskProgressEvent = {
  status:         'completed',
  items_total:    0,
  items_done:     0,
  items_failed:   0,
  items_skipped:  0,
  current_action: 'parsing'
}

const failedEvent: AutomationTaskProgressEvent = {
  ...completedEvent,
  status:        'failed',
  error_message: 'Instagram требует подтверждение входа (challenge/checkpoint)'
}

describe('useParseProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    listenHandler = null
  })

  afterEach(() => vi.useRealTimers())

  it('completed + items_total===0 → терминал без ожидания backstop', async () => {
    const onDone = vi.fn<(taskId: number) => Promise<number>>().mockResolvedValue(0)
    const onSettled = vi.fn()
    useParseProgress({ onDone, onSettled }).watchParse(TASK_ID)

    // items_total=0: не гонка коммита, а реально 0 целей → force-завершение без backstop
    listenHandler?.({ ...completedEvent, items_total: 0 })
    await vi.advanceTimersByTimeAsync(0)

    expect(onDone).toHaveBeenCalledWith(TASK_ID)
    expect(echo.leave).toHaveBeenCalledWith(`automation-task.${String(TASK_ID)}`)
    expect(onSettled).toHaveBeenCalledWith(TASK_ID)
    // Backstop (120с) НЕ нужен — уже завершили
    expect(onSettled).toHaveBeenCalledTimes(1)
  })

  it('completed + items_total>0 → поведение как раньше (onDone→leave)', async () => {
    const onDone = vi.fn<(taskId: number) => Promise<number>>().mockResolvedValue(3)
    useParseProgress({ onDone }).watchParse(TASK_ID)

    listenHandler?.({ ...completedEvent, items_total: 5 })
    await vi.advanceTimersByTimeAsync(0)

    expect(onDone).toHaveBeenCalledWith(TASK_ID)
    expect(echo.leave).toHaveBeenCalledWith(`automation-task.${String(TASK_ID)}`)
  })


  it('поздно пришедшее completed после исчерпания старого бюджета всё равно завершает (нет преждевременного leave)', async () => {
    // Цели появляются только после реального завершения парса (~30с) — все рефетчи до этого дают 0.
    const onDone = vi.fn<(taskId: number) => Promise<number>>().mockResolvedValue(0)
    useParseProgress({ onDone }).watchParse(TASK_ID)

    // Прокручиваем за пределы старого 20-секундного бюджета — поллинг продолжается, leave НЕ зван.
    await vi.advanceTimersByTimeAsync(OLD_BUDGET_MS + POLL_INTERVAL_MS)
    expect(onDone).toHaveBeenCalled()
    expect(echo.leave).not.toHaveBeenCalled()

    // Парс завершился — теперь рефетч отдаёт цели; запоздавшее WS-событие ведёт к завершению.
    onDone.mockResolvedValue(3)
    listenHandler?.({ ...completedEvent, items_total: 3 })
    await vi.advanceTimersByTimeAsync(0)

    expect(echo.leave).toHaveBeenCalledWith(`automation-task.${String(TASK_ID)}`)
  })

  it('гонка completed + пустой рефетч → повторный рефетч поллингом до появления целей', async () => {
    // Первый рефетч (по событию) пуст — транзакция targets ещё не докоммичена; следующий даёт цели.
    const onDone = vi.fn<(taskId: number) => Promise<number>>()
      .mockResolvedValueOnce(0)
      .mockResolvedValue(5)
    useParseProgress({ onDone }).watchParse(TASK_ID)

    // items_total>0: цели есть, но ещё не докоммичены → гонка broadcast-vs-commit
    listenHandler?.({ ...completedEvent, items_total: 5 })
    await vi.advanceTimersByTimeAsync(0)
    // count===0 — это гонка, а не «целей нет»: не завершаемся, канал держим.
    expect(echo.leave).not.toHaveBeenCalled()

    // Следующий тик поллинга получает цели → терминал.
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(onDone.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(echo.leave).toHaveBeenCalledWith(`automation-task.${String(TASK_ID)}`)
  })

  it('status=failed при current_action=parsing вызывает onFail и отписку', async () => {
    const onDone = vi.fn<(taskId: number) => Promise<number>>().mockResolvedValue(0)
    const onFail = vi.fn()
    useParseProgress({ onDone, onFail }).watchParse(TASK_ID)

    listenHandler?.(failedEvent)
    await vi.advanceTimersByTimeAsync(0)

    expect(onFail).toHaveBeenCalledWith(TASK_ID, 'Instagram требует подтверждение входа (challenge/checkpoint)')
    expect(echo.leave).toHaveBeenCalledWith(`automation-task.${String(TASK_ID)}`)
  })

  it('по backstop-таймауту делается финальный рефетч и завершение', async () => {
    const onDone = vi.fn<(taskId: number) => Promise<number>>().mockResolvedValue(0)
    useParseProgress({ onDone }).watchParse(TASK_ID)

    // До backstop (120с) с пустыми рефетчами завершения нет.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(echo.leave).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(echo.leave).toHaveBeenCalledWith(`automation-task.${String(TASK_ID)}`)
  })
})
