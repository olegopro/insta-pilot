import type { Nullable } from '@/shared/lib'

export type SourceType = 'hashtag' | 'location' | 'hashtag_location' | 'hashtag_list'
export type AutomationMode = 'semi_auto' | 'full_auto'
export type AutomationActionType = 'comment' | 'like' | 'follow' | 'unfollow'

export interface SourceConfig {
  type: SourceType
  // Хэштеги (для hashtag / hashtag_list / hashtag_location)
  hashtags: string[]
  // Гео-локация (для location / hashtag_location)
  locationPk: Nullable<number>
  locationName: Nullable<string>
}

export interface NumberRange {
  min: Nullable<number>
  max: Nullable<number>
}

// Конфиг фильтров отбора целей. Каждый фильтр OFF по умолчанию (enabled=false),
// чтобы не множить дорогие IG-запросы. Группировка соответствует UI-форме (§8.3).
export interface AudienceFilters {
  enabled: boolean
  followers: NumberRange
  following: NumberRange
}

export interface ContentFilters {
  enabled: boolean
  lastPostMaxAgeDays: Nullable<number>
  likesSumMin: Nullable<number>
  avgLikesPostsCount: Nullable<number>
  avgLikes: NumberRange
}

export interface KeywordFilters {
  enabled: boolean
  whitelist: string[]
  blacklist: string[]
}

export interface AutomationFilters {
  audience: AudienceFilters
  content: ContentFilters
  keywords: KeywordFilters
}

// Полный черновик конфигурации парсинга (UI-state до отправки store-запроса).
export interface ParsingDraft {
  accountId: Nullable<number>
  mode: AutomationMode
  actionType: AutomationActionType
  source: SourceConfig
  filters: AutomationFilters
  targetCount: number
}
