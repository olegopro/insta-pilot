import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { LlmSettingApi, LlmBasePromptApi } from '@/entities/llm-settings/model/apiTypes'

vi.mock('@/boot/axios', () => ({
  api: {
    get:    vi.fn(),
    post:   vi.fn(),
    put:    vi.fn(),
    patch:  vi.fn(),
    delete: vi.fn()
  }
}))

import { api } from '@/boot/axios'
import { useLlmSettingsStore } from '@/entities/llm-settings/model/llmSettingsStore'

const makeSettingApi = (overrides: Partial<LlmSettingApi> = {}): LlmSettingApi => ({
  id:            1,
  provider:      'openai',
  model_name:    'gpt-4o-mini',
  system_prompt: null,
  tone:          'friendly',
  use_caption:   true,
  is_default:    false,
  created_at:    '2026-01-01T00:00:00Z',
  updated_at:    '2026-01-01T00:00:00Z',
  ...overrides
})

const wrapResponse = <T>(data: T) => ({
  data: { success: true, data, message: 'OK' }
})

describe('llmSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchAll загружает настройки', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      wrapResponse([makeSettingApi(), makeSettingApi({ id: 2, provider: 'glm' })])
    )

    const store = useLlmSettingsStore()
    await store.fetchAll()

    expect(store.settings).toHaveLength(2)
    expect(store.settings[0]!.provider).toBe('openai')
  })

  it('fetchAll маппит snake_case в camelCase', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      wrapResponse([makeSettingApi({ is_default: true, use_caption: false })])
    )

    const store = useLlmSettingsStore()
    await store.fetchAll()

    const setting = store.settings[0]!
    expect(setting.isDefault).toBe(true)
    expect(setting.useCaption).toBe(false)
    expect(setting.modelName).toBe('gpt-4o-mini')
  })

  it('saveSetting отправляет POST и перезагружает список', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(wrapResponse(makeSettingApi()))
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse([makeSettingApi()]))

    const store = useLlmSettingsStore()
    await store.saveSetting({
      provider:     'openai',
      apiKey:       'sk-test',
      modelName:    'gpt-4o-mini',
      systemPrompt: null,
      tone:         'friendly',
      useCaption:   true
    })

    expect(api.post).toHaveBeenCalledWith('/llm-settings', expect.objectContaining({
      provider:   'openai',
      api_key:    'sk-test',
      model_name: 'gpt-4o-mini'
    }))
    expect(store.settings).toHaveLength(1)
  })

  it('setDefault отправляет PATCH и перезагружает список', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(wrapResponse(null))
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse([makeSettingApi({ is_default: true })]))

    const store = useLlmSettingsStore()
    await store.setDefault(1)

    expect(api.patch).toHaveBeenCalledWith('/llm-settings/1/default')
    expect(store.settings[0]!.isDefault).toBe(true)
  })

  it('deleteSetting отправляет DELETE и перезагружает список', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce(wrapResponse(null))
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse([]))

    const store = useLlmSettingsStore()
    await store.deleteSetting(1)

    expect(api.delete).toHaveBeenCalledWith('/llm-settings/1')
    expect(store.settings).toHaveLength(0)
  })

  it('testConnection отправляет POST /llm-settings/test', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(wrapResponse(null))

    const store = useLlmSettingsStore()
    await store.testConnection('openai', 'sk-key', 'gpt-4o-mini')

    expect(api.post).toHaveBeenCalledWith('/llm-settings/test', {
      provider:   'openai',
      api_key:    'sk-key',
      model_name: 'gpt-4o-mini'
    })
  })

  it('fetchBasePrompt загружает и сохраняет контент', async () => {
    const prompt: LlmBasePromptApi = { content: 'You are an assistant', is_modified: false }
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(prompt))

    const store = useLlmSettingsStore()
    await store.fetchBasePrompt()

    expect(store.basePrompt).toBe('You are an assistant')
    expect(store.basePromptIsModified).toBe(false)
  })

  it('updateBasePrompt обновляет контент', async () => {
    const updated: LlmBasePromptApi = { content: 'New prompt', is_modified: true }
    vi.mocked(api.put).mockResolvedValueOnce(wrapResponse(updated))

    const store = useLlmSettingsStore()
    await store.updateBasePrompt('New prompt')

    expect(store.basePrompt).toBe('New prompt')
    expect(store.basePromptIsModified).toBe(true)
  })

  it('resetBasePrompt сбрасывает к default', async () => {
    const reset: LlmBasePromptApi = { content: 'Default prompt', is_modified: false }
    vi.mocked(api.post).mockResolvedValueOnce(wrapResponse(reset))

    const store = useLlmSettingsStore()
    await store.resetBasePrompt()

    expect(store.basePrompt).toBe('Default prompt')
    expect(store.basePromptIsModified).toBe(false)
  })

  it('fetchAllLoading изначально false', () => {
    const store = useLlmSettingsStore()
    expect(store.fetchAllLoading).toBe(false)
  })

  it('fetchAll при ошибке бросает исключение', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'))

    const store = useLlmSettingsStore()

    await expect(store.fetchAll()).rejects.toThrow()
    expect(store.settings).toHaveLength(0)
  })

  it('saveSetting при ошибке бросает исключение', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Unprocessable'))

    const store = useLlmSettingsStore()

    await expect(store.saveSetting({
      provider:     'openai',
      apiKey:       'sk-bad',
      modelName:    'gpt-4o-mini',
      systemPrompt: null,
      tone:         'friendly',
      useCaption:   true
    })).rejects.toThrow()
  })

  it('setDefault при ошибке бросает исключение', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(new Error('Not Found'))

    const store = useLlmSettingsStore()

    await expect(store.setDefault(999)).rejects.toThrow()
  })

  it('deleteSetting при ошибке бросает исключение', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce(new Error('Not Found'))

    const store = useLlmSettingsStore()

    await expect(store.deleteSetting(999)).rejects.toThrow()
  })

  it('testConnection при ошибке бросает исключение', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Unauthorized'))

    const store = useLlmSettingsStore()

    await expect(store.testConnection('openai', 'bad-key', 'gpt-4o-mini')).rejects.toThrow()
  })

  it('fetchBasePrompt при ошибке бросает исключение', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'))

    const store = useLlmSettingsStore()

    await expect(store.fetchBasePrompt()).rejects.toThrow()
  })

  it('updateBasePrompt при ошибке бросает исключение', async () => {
    vi.mocked(api.put).mockRejectedValueOnce(new Error('Server Error'))

    const store = useLlmSettingsStore()

    await expect(store.updateBasePrompt('bad prompt')).rejects.toThrow()
  })

  it('resetBasePrompt при ошибке бросает исключение', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Server Error'))

    const store = useLlmSettingsStore()

    await expect(store.resetBasePrompt()).rejects.toThrow()
  })
})
