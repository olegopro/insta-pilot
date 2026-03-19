import type { ActionType, ActionStatus } from './types'

export const ACTION_LABELS: Record<ActionType, string> = {
  login:                  'Авторизация',
  fetch_feed:             'Лента',
  like:                   'Лайк',
  comment:                'Комментарий',
  search_hashtag:         'Поиск хэштег',
  search_locations:       'Поиск локаций',
  search_location_medias: 'Медиа локации',
  fetch_user_info:        'Инфо пользователя',
  generate_comment:       'Генерация комм.'
}

export const ACTION_ICONS: Record<ActionType, string> = {
  login:                  'login',
  fetch_feed:             'dynamic_feed',
  like:                   'favorite',
  comment:                'chat_bubble',
  search_hashtag:         'tag',
  search_locations:       'place',
  search_location_medias: 'photo_library',
  fetch_user_info:        'person',
  generate_comment:       'auto_awesome'
}

export const ACTION_COLORS: Record<ActionType, string> = {
  login:                  'blue-grey',
  fetch_feed:             'blue',
  like:                   'pink',
  comment:                'purple',
  search_hashtag:         'green',
  search_locations:       'teal',
  search_location_medias: 'teal',
  fetch_user_info:        'grey',
  generate_comment:       'orange'
}

export interface StatusConfig {
  label: string
  icon: string
  color: string
}

export const STATUS_CONFIG: Record<ActionStatus, StatusConfig> = {
  success:            { label: 'Успешно', icon: 'check_circle', color: 'positive' },
  error:              { label: 'Ошибка', icon: 'error', color: 'negative' },
  rate_limited:       { label: 'Лимит', icon: 'hourglass_top', color: 'warning' },
  challenge_required: { label: 'Подтверждение', icon: 'lock', color: 'warning' },
  login_required:     { label: 'Нет сессии', icon: 'vpn_key', color: 'warning' },
  timeout:            { label: 'Таймаут', icon: 'timer_off', color: 'grey' }
}

export const HTTP_CODE_COLOR = (code: number | null): string => {
  if (code === null) return ''
  if (code >= 200 && code < 300) return 'positive'
  if (code >= 400 && code < 500) return 'warning'
  if (code >= 500) return 'negative'
  return 'grey'
}
