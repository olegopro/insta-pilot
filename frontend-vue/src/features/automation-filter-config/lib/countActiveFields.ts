import type {
  AudienceFilters,
  ContentFilters,
  KeywordFilters,
  NumberRange
} from '@/entities/automation-parsing'
import type { Nullable } from '@/shared/lib'

const isSet = (value: Nullable<number>): boolean => value !== null

const rangeActiveCount = (range: NumberRange): number =>
  (isSet(range.min) ? 1 : 0) + (isSet(range.max) ? 1 : 0)

// Считает количество заполненных полей в группе (для бейджа активных).
export const countAudienceFields = (filters: AudienceFilters): number =>
  filters.enabled ? rangeActiveCount(filters.followers) + rangeActiveCount(filters.following) : 0

export const countContentFields = (filters: ContentFilters): number => {
  if (!filters.enabled) return 0
  return (isSet(filters.lastPostMaxAgeDays) ? 1 : 0)
    + (isSet(filters.likesSumMin) ? 1 : 0)
    + rangeActiveCount(filters.avgLikes)
}

export const countKeywordFields = (filters: KeywordFilters): number =>
  filters.enabled ? filters.whitelist.length + filters.blacklist.length : 0
