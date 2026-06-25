import { getActionTypeLabel } from '@/entities/automation-action'
import type { AutomationTask, AutomationTaskStatus } from '@/entities/automation-task'
import type { Nullable } from '@/shared/lib'

interface StatusMeta {
  label: string
  color: string
}

export const TASK_STATUS_META: Record<AutomationTaskStatus, StatusMeta> = {
  draft: { label: 'Черновик', color: 'grey' },
  scheduling: { label: 'Планирование', color: 'info' },
  running: { label: 'Выполняется', color: 'primary' },
  paused: { label: 'Пауза', color: 'warning' },
  completed: { label: 'Завершена', color: 'positive' },
  failed: { label: 'Ошибка', color: 'negative' },
  cancelled: { label: 'Отменена', color: 'grey' }
}

export const isActiveStatus = (status: AutomationTaskStatus): boolean =>
  status === 'running' || status === 'scheduling'

export const isPausedStatus = (status: AutomationTaskStatus): boolean => status === 'paused'

// Отменяемые статусы: задача уже запущена/планируется/на паузе. У draft и терминальных
// статусов кнопки управления (включая отмену) не показываем.
export const canCancelStatus = (status: AutomationTaskStatus): boolean =>
  status === 'running' || status === 'scheduling' || status === 'paused'

// Запуск показываем только у черновика: цели собраны, ждут ручного старта.
export const canStartStatus = (status: AutomationTaskStatus): boolean => status === 'draft'

export const isTerminalStatus = (status: AutomationTaskStatus): boolean =>
  status === 'completed' || status === 'failed' || status === 'cancelled'

// Удалять можно черновик (ещё не запускался) и терминальные задачи (уже отработали).
// Активные/планируемые/на паузе (running/scheduling/paused) удалять нельзя.
export const canDeleteStatus = (status: AutomationTaskStatus): boolean =>
  status === 'draft' || isTerminalStatus(status)

// Текущее действие для карточки: только на активных статусах и через локализованный лейбл;
// 'parsing'/неизвестное/терминальное/draft → null (сырое значение не показываем).
export const currentActionLabel = (task: Pick<AutomationTask, 'status' | 'currentAction'>): Nullable<string> =>
  isActiveStatus(task.status) ? getActionTypeLabel(task.currentAction) : null

// Текст терминальной задачи без action-items (itemsTotal===0) вместо «0/0».
export const emptyTerminalText = (task: Pick<AutomationTask, 'itemsSkipped'>): string =>
  task.itemsSkipped > 0 ? 'Все цели уже обработаны ранее' : 'Новых целей не найдено'

// Что показывать в stats-блоке карточки:
// - 'collected' — черновик: число собранных целей (execution-айтемов ещё нет);
// - 'empty'     — терминальная задача без айтемов (itemsTotal===0) → текст emptyTerminalText;
// - 'counters'  — обычные счётчики Всего/Готово/Ошибки/Пропущено (running/paused/scheduling/терминал с N).
export type TaskStatsKind = 'collected' | 'empty' | 'counters'

export const taskStatsKind = (task: Pick<AutomationTask, 'status' | 'itemsTotal'>): TaskStatsKind => {
  if (task.status === 'draft') return 'collected'
  if (isTerminalStatus(task.status) && task.itemsTotal === 0) return 'empty'
  return 'counters'
}

// Фаза черновика для UI: уточняет статус 'draft' (сбор целей идёт / готово / провал / пусто).
export type DraftPhaseKind = 'parsing' | 'ready' | 'failed' | 'draft'

export interface DraftPhaseMeta {
  kind: DraftPhaseKind
  label: string
  color: string
  icon: Nullable<string>
}

// Раскладка фазы черновика по parseStatus + числу собранных целей. Порядок ветвей важен:
// активный парсинг → провал → готово (parseStatus='done' ИЛИ уже есть собранные цели) →
// нейтральный черновик. parseStatus=null (бэк не прислал) деградирует к ready/draft по count.
export const draftPhase = (
  task: Pick<AutomationTask, 'parseStatus' | 'collectedTargetsCount'>
): DraftPhaseMeta => {
  if (task.parseStatus === 'parsing') return { kind: 'parsing', label: 'Идёт сбор целей', color: 'info', icon: 'sync' }
  if (task.parseStatus === 'failed') return { kind: 'failed', label: 'Ошибка сбора', color: 'negative', icon: 'error' }
  if (task.parseStatus === 'done' || task.collectedTargetsCount > 0) return { kind: 'ready', label: 'Готово к запуску', color: 'positive', icon: 'check_circle' }
  return { kind: 'draft', label: 'Черновик', color: 'grey', icon: null }
}

// ── Фильтр/сортировка списка задач (клиентские, для тулбара виджета) ──────────
export type TaskListFilter = 'all' | 'active' | 'draft' | 'completed'
export type TaskListSort = 'newest' | 'oldest'

export const TASK_FILTER_OPTIONS: { label: string; value: TaskListFilter }[] = [
  { label: 'Все', value: 'all' },
  { label: 'Активные', value: 'active' },
  { label: 'Черновики', value: 'draft' },
  { label: 'Завершённые', value: 'completed' }
]

export const TASK_SORT_OPTIONS: { label: string; value: TaskListSort }[] = [
  { label: 'Сначала новые', value: 'newest' },
  { label: 'Сначала старые', value: 'oldest' }
]

// Совпадение статуса с фильтром: активные = running/scheduling/paused, завершённые = терминальные.
export const matchesFilter = (status: AutomationTaskStatus, filter: TaskListFilter): boolean => {
  if (filter === 'all') return true
  if (filter === 'active') return isActiveStatus(status) || isPausedStatus(status)
  if (filter === 'draft') return status === 'draft'
  return isTerminalStatus(status)
}

// Фильтрация + сортировка по id (монотонный, новые = больший id). Не мутирует исходный массив.
export const filterAndSortTasks = (
  tasks: AutomationTask[],
  filter: TaskListFilter,
  sort: TaskListSort
): AutomationTask[] =>
  tasks
    .filter((task) => matchesFilter(task.status, filter))
    .slice()
    .sort((left, right) => sort === 'newest' ? right.id - left.id : left.id - right.id)
