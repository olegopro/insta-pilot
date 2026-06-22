import { onBeforeUnmount } from 'vue'
import { echo } from '@/shared/lib'
import type { AutomationTaskProgressEvent } from '@/entities/automation-task'

// Прогресс парсинга приходит на тот же канал automation-task.{taskId} событием
// .AutomationTaskProgress с current_action='parsing'. Завершение парсинга — это
// терминальный статус ('completed' успех / 'failed' ошибка) при current_action='parsing'.
const PARSE_ACTION = 'parsing'
const DONE_STATUSES = ['completed']
const FAIL_STATUSES = ['failed']

// Fallback-поллинг на случай пропущенного Echo-события (доставка не гарантирована):
// периодический рефетч целей, пока парс не дал терминальный исход.
const POLL_INTERVAL_MS = 2500
// Абсолютная страховка: реальный парс хэштега + enrich занимает 30–60с и более, поэтому
// общий бюджет заведомо больше worst-case. По его истечении — финальный рефетч и сдача,
// чтобы не остаться в подвешенном состоянии (а НЕ преждевременный отказ по числу попыток).
const BACKSTOP_TIMEOUT_MS = 120_000

interface ParseProgressOptions {
  // Рефетч целей задачи (источник истины после завершения парсинга). Возвращает количество
  // полученных целей: >0 — терминальный успех парса (цели закоммичены и доступны).
  onDone: (taskId: number) => Promise<number>
  // Колбэк ошибки парсинга (status='failed' с current_action='parsing').
  onFail?: (taskId: number) => void
  // Терминальное завершение парса: цели получены (count>0) ИЛИ исчерпан backstop. Вызывается
  // один раз, НЕЗАВИСИМО от числа целей — для сброса визуальных флагов даже при 0 целях.
  onSettled?: (taskId: number) => void
}

// Подписка на завершение async-парсинга задачи. После dispatch ParseTargetsJob бэк шлёт
// прогресс по WebSocket; терминальный исход — это получение целей (count>0) либо status='failed'.
// Параллельно крутим fallback-поллинг тем же onDone: если Echo-событие не дошло или пришло
// раньше коммита целей (гонка broadcast-vs-commit), цели всё равно подтянутся повторным рефетчем.
export function useParseProgress(options: ParseProgressOptions) {
  let channelTaskId: number | null = null
  let pollHandle: ReturnType<typeof setInterval> | null = null
  let backstopHandle: ReturnType<typeof setTimeout> | null = null
  let settled = false
  let probing = false

  const stopTimers = () => {
    pollHandle && clearInterval(pollHandle)
    backstopHandle && clearTimeout(backstopHandle)
    pollHandle = null
    backstopHandle = null
  }

  const leave = () => {
    stopTimers()
    if (channelTaskId !== null) {
      echo.leave(`automation-task.${String(channelTaskId)}`)
      channelTaskId = null
    }
  }

  const finishFail = (taskId: number) => {
    if (settled) return
    settled = true
    leave()
    options.onFail?.(taskId)
  }

  // Пытается терминально завершить парс: рефетчит цели и, если они получены (count>0),
  // фиксирует терминал (отписка + стоп таймеров). Иначе — это гонка broadcast-vs-commit
  // (событие 'completed' пришло раньше коммита targets) либо парс ещё идёт: НЕ сдаёмся,
  // оставляем WS-подписку и поллинг до появления целей или backstop. force=true — финальный
  // рефетч по backstop: завершаем безусловно, минуя guard занятости, чтобы не залипнуть.
  const tryFinish = async (taskId: number, force = false): Promise<void> => {
    if (settled || (probing && !force)) return
    probing = true
    const count = await options.onDone(taskId).catch(() => 0)
    probing = false
    if (count > 0 || force) {
      settled = true
      leave()
      options.onSettled?.(taskId)
    }
  }

  // Слушает прогресс задачи: на 'failed' — терминальная ошибка; на 'completed' — пробуем
  // забрать цели (с учётом гонки коммита). Параллельно держим fallback-поллинг и backstop.
  const watchParse = (taskId: number) => {
    leave()
    settled = false
    probing = false
    channelTaskId = taskId

    echo.private(`automation-task.${String(taskId)}`)
      .listen('.AutomationTaskProgress', (event: AutomationTaskProgressEvent) => {
        if (event.current_action !== PARSE_ACTION) return
        FAIL_STATUSES.includes(event.status) && finishFail(taskId)
        if (DONE_STATUSES.includes(event.status)) {
          // items_total===0 означает «целей нет», не гонку коммита — завершаем сразу (force)
          event.items_total === 0
            ? void tryFinish(taskId, true)
            : void tryFinish(taskId)
        }
      })

    pollHandle = setInterval(() => void tryFinish(taskId), POLL_INTERVAL_MS)
    backstopHandle = setTimeout(() => void tryFinish(taskId, true), BACKSTOP_TIMEOUT_MS)
  }

  onBeforeUnmount(leave)

  return { watchParse, leave }
}
