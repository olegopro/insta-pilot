import type { AutomationActionType } from '@/entities/automation-parsing'

// Опция типа действия для UI-выбора в кокпите. disabled — задел под future-действия
// (follow/unfollow), которые ещё не реализованы в движке.
export interface ActionTypeOption {
  label: string
  value: AutomationActionType
  icon: string
  disable: boolean
}

// Доступные типы действий движка. comment/like — рабочие (бэкенд поддерживает),
// follow/unfollow — future-disabled (Phase 6 бэклога).
export const ACTION_TYPE_OPTIONS: ActionTypeOption[] = [
  { label: 'Комментарий', value: 'comment', icon: 'chat_bubble', disable: false },
  { label: 'Лайк', value: 'like', icon: 'favorite', disable: false },
  { label: 'Подписка', value: 'follow', icon: 'person_add', disable: true },
  { label: 'Отписка', value: 'unfollow', icon: 'person_remove', disable: true }
]

// Действия, требующие LLM-генерации текста (конфиг тона/шаблона/use_caption).
// Для остальных (like) конфиг комментария скрывается — LLM не задействован.
export const LLM_ACTION_TYPES: AutomationActionType[] = ['comment']

export const isLlmAction = (actionType: AutomationActionType): boolean =>
  LLM_ACTION_TYPES.includes(actionType)
