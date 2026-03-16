import type { Nullable } from '@/shared/lib'

export type LlmProvider = 'glm' | 'openai'
export type LlmTone = 'friendly' | 'professional' | 'casual' | 'humorous'

export interface LlmSetting {
  id: number
  provider: LlmProvider
  modelName: string
  systemPrompt: Nullable<string>
  tone: LlmTone
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface LlmSettingFormData {
  provider: LlmProvider
  apiKey: string
  modelName: string
  systemPrompt: Nullable<string>
  tone: LlmTone
}
