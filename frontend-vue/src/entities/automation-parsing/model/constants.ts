import type {
  AutomationFilters,
  AutomationMode,
  ParsingDraft,
  SourceConfig,
  SourceType
} from '@/entities/automation-parsing/model/types'

// Дефолты из §9 архитектуры: target_count cap ~200, дефолт окна и т.п.
export const TARGET_COUNT_DEFAULT = 200
export const TARGET_COUNT_MAX = 200
export const TARGET_COUNT_MIN = 1

export const SOURCE_TYPE_OPTIONS: { label: string; value: SourceType }[] = [
  { label: 'Хэштег', value: 'hashtag' },
  { label: 'Гео', value: 'location' },
  { label: 'Хэштег + Гео', value: 'hashtag_location' },
  { label: 'Список тегов', value: 'hashtag_list' }
]

export const MODE_OPTIONS: { label: string; value: AutomationMode }[] = [
  { label: 'Полу-ручной', value: 'semi_auto' },
  { label: 'Полностью авто', value: 'full_auto' }
]

export const createDefaultSource = (): SourceConfig => ({
  type: 'hashtag',
  hashtags: [],
  locationPk: null,
  locationName: null
})

export const createDefaultFilters = (): AutomationFilters => ({
  audience: {
    enabled: false,
    followers: { min: null, max: null },
    following: { min: null, max: null }
  },
  content: {
    enabled: false,
    lastPostMaxAgeDays: null,
    likesSumMin: null,
    avgLikesPostsCount: 6,
    avgLikes: { min: null, max: null }
  },
  keywords: {
    enabled: false,
    whitelist: [],
    blacklist: []
  }
})

export const createDefaultDraft = (): ParsingDraft => ({
  accountId: null,
  mode: 'semi_auto',
  actionType: 'comment',
  source: createDefaultSource(),
  filters: createDefaultFilters(),
  targetCount: TARGET_COUNT_DEFAULT
})
