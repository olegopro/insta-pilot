import type { AutomationActionType } from '@/entities/automation-parsing'

// Опция типа действия для UI-выбора в кокпите. disabled — задел под future-действия,
// которые ещё не реализованы в движке.
export interface ActionTypeOption {
  label: string
  value: AutomationActionType
  icon: string
  disable: boolean
}

// Доступные типы действий движка. comment/like/follow — рабочие (бэкенд поддерживает).
// unfollow — disabled: отписка требует источник «мой список подписок» (текущие подписки
// аккаунта), а хэштег-парсинг целей для неё не годится. Будет включена, когда появится
// этот источник целей (Phase 6+).
export const ACTION_TYPE_OPTIONS: ActionTypeOption[] = [
  { label: 'Комментарий', value: 'comment', icon: 'chat_bubble', disable: false },
  { label: 'Лайк', value: 'like', icon: 'favorite', disable: false },
  { label: 'Подписка', value: 'follow', icon: 'person_add', disable: false },
  { label: 'Отписка', value: 'unfollow', icon: 'person_remove', disable: true }
]

// Действия, требующие LLM-генерации текста (конфиг тона/шаблона/use_caption).
// Для остальных (like, follow) конфиг комментария скрывается — LLM не задействован.
export const LLM_ACTION_TYPES: AutomationActionType[] = ['comment']

export const isLlmAction = (actionType: AutomationActionType): boolean =>
  LLM_ACTION_TYPES.includes(actionType)
