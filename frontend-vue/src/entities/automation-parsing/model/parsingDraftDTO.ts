import type { ParsingDraft } from '@/entities/automation-parsing/model/types'
import type { CommentActionConfig } from '@/entities/automation-task/model/types'
import type { CreateAutomationTaskRequestApi } from '@/entities/automation-task/model/apiTypes'

class ParsingDraftDTO {
  // Источник → snake_case value по типу. Laravel сам решает композицию hashtag+гео.
  private buildSourceValue(draft: ParsingDraft): Record<string, unknown> {
    const { source } = draft
    const value: Record<string, unknown> = {}

    if (source.type === 'hashtag' || source.type === 'hashtag_list' || source.type === 'hashtag_location') {
      value.hashtags = source.hashtags
    }
    if (source.type === 'location' || source.type === 'hashtag_location') {
      value.location_pk = source.locationPk
      value.location_name = source.locationName
    }

    return value
  }

  // Только активные группы фильтров уходят на бэк (OFF-группы не шлём — экономия запросов).
  private buildFilters(draft: ParsingDraft): Record<string, unknown> {
    const { audience, content, keywords } = draft.filters
    const filters: Record<string, unknown> = {}

    if (audience.enabled) {
      filters.followers = { min: audience.followers.min, max: audience.followers.max }
      filters.following = { min: audience.following.min, max: audience.following.max }
    }
    if (content.enabled) {
      filters.last_post_max_age_days = content.lastPostMaxAgeDays
      filters.likes_sum_min = content.likesSumMin
      filters.avg_likes_posts_count = content.avgLikesPostsCount
      filters.avg_likes = { min: content.avgLikes.min, max: content.avgLikes.max }
    }
    if (keywords.enabled) {
      filters.whitelist = keywords.whitelist
      filters.blacklist = keywords.blacklist
    }

    return filters
  }

  private buildActionConfig(draft: ParsingDraft, commentConfig: CommentActionConfig): Record<string, unknown> {
    if (draft.actionType !== 'comment') return {}
    return {
      llm_setting_id: commentConfig.llmSettingId,
      tone: commentConfig.tone,
      template: commentConfig.template,
      use_caption: commentConfig.useCaption
    }
  }

  toCreateRequest(draft: ParsingDraft, commentConfig: CommentActionConfig): CreateAutomationTaskRequestApi {
    return {
      instagram_account_id: draft.accountId ?? 0,
      mode: draft.mode,
      action_type: draft.actionType,
      source: {
        type: draft.source.type,
        value: this.buildSourceValue(draft)
      },
      filters: this.buildFilters(draft),
      target_count: draft.targetCount,
      action_config: this.buildActionConfig(draft, commentConfig)
    }
  }
}

export default new ParsingDraftDTO()
