import type { Nullable } from '@/shared/lib'

export interface LlmSettingApi {
  id: number
  provider: string
  model_name: string
  system_prompt: Nullable<string>
  tone: string
  use_caption: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface LlmSettingDetailApi extends LlmSettingApi {
  api_key: string
}

export interface LlmBasePromptApi {
  content: string
  is_modified: boolean
}
