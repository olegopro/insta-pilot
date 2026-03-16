import type { Nullable } from '@/shared/lib'

export interface LlmSettingApi {
  id: number
  provider: string
  model_name: string
  system_prompt: Nullable<string>
  tone: string
  is_default: boolean
  created_at: string
  updated_at: string
}
