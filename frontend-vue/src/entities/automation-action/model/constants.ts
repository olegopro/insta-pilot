import type { Nullable } from '@/shared/lib'
import type { AutomationActionType } from '@/entities/automation-parsing'

// Опция типа действия для UI-выбора в кокпите. disabled — задел под future-действия,
// которые ещё не реализованы в движке.
export interface ActionTypeOption {
  label: string
  value: AutomationActionType
  icon: string
  disable: boolean
}

// Доступные типы действий движка. Все рабочие (бэкенд поддерживает). unfollow использует
// источник 'my_following' (текущие подписки аккаунта-исполнителя) — без хэштег-парсинга и
// фильтров; UI выбора источника для отписки скрыт.
export const ACTION_TYPE_OPTIONS: ActionTypeOption[] = [
  { label: 'Комментарий', value: 'comment', icon: 'chat_bubble', disable: false },
  { label: 'Лайк', value: 'like', icon: 'favorite', disable: false },
  { label: 'Подписка', value: 'follow', icon: 'person_add', disable: false },
  { label: 'Отписка', value: 'unfollow', icon: 'person_remove', disable: false }
]

// Действия, требующие LLM-генерации текста (конфиг тона/шаблона/use_caption).
// Для остальных (like, follow) конфиг комментария скрывается — LLM не задействован.
export const LLM_ACTION_TYPES: AutomationActionType[] = ['comment']

export const isLlmAction = (actionType: AutomationActionType): boolean =>
  LLM_ACTION_TYPES.includes(actionType)

// Локализованные лейблы типов действий для отображения текущего шага задачи.
export const ACTION_TYPE_LABELS: Record<AutomationActionType, string> = {
  comment: 'Комментарий',
  like: 'Лайк',
  follow: 'Подписка',
  unfollow: 'Отписка'
}

// Лейбл текущего действия для карточки задачи. Возвращает null для 'parsing' и
// неизвестных значений — такие на карточке не показываем.
export const getActionTypeLabel = (actionType: Nullable<string>): Nullable<string> =>
  actionType && actionType in ACTION_TYPE_LABELS
    ? ACTION_TYPE_LABELS[actionType as AutomationActionType]
    : null
