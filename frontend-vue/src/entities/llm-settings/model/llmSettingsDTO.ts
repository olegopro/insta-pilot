import type { LlmSetting, LlmProvider, LlmTone } from './types'
import type { LlmSettingApi } from './apiTypes'

class LlmSettingsDTO {
  toLocal(item: LlmSettingApi): LlmSetting {
    return {
      id: item.id,
      provider: item.provider as LlmProvider,
      modelName: item.model_name,
      systemPrompt: item.system_prompt,
      tone: item.tone as LlmTone,
      useCaption: item.use_caption,
      isDefault: item.is_default,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }
  }

  toLocalList(items: LlmSettingApi[]): LlmSetting[] {
    return items.map((item) => this.toLocal(item))
  }
}

export default new LlmSettingsDTO()
