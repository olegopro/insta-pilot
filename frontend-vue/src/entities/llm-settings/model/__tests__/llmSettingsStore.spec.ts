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

  it.each([
    {
      name:   'fetchAll',
      method: 'get' as const,
      run:    (store: ReturnType<typeof useLlmSettingsStore>) => store.fetchAll()
    },
    {
      name:   'saveSetting',
      method: 'post' as const,
      run:    (store: ReturnType<typeof useLlmSettingsStore>) => store.saveSetting({
        provider:     'openai',
        apiKey:       'sk-bad',
        modelName:    'gpt-4o-mini',
        systemPrompt: null,
        tone:         'friendly',
        useCaption:   true
      })
    },
    {
      name:   'setDefault',
      method: 'patch' as const,
      run:    (store: ReturnType<typeof useLlmSettingsStore>) => store.setDefault(999)
    },
    {
      name:   'deleteSetting',
      method: 'delete' as const,
      run:    (store: ReturnType<typeof useLlmSettingsStore>) => store.deleteSetting(999)
    },
    {
      name:   'testConnection',
      method: 'post' as const,
      run:    (store: ReturnType<typeof useLlmSettingsStore>) => store.testConnection('openai', 'bad-key', 'gpt-4o-mini')
    },
    {
      name:   'fetchBasePrompt',
      method: 'get' as const,
      run:    (store: ReturnType<typeof useLlmSettingsStore>) => store.fetchBasePrompt()
    },
    {
      name:   'updateBasePrompt',
      method: 'put' as const,
      run:    (store: ReturnType<typeof useLlmSettingsStore>) => store.updateBasePrompt('bad prompt')
    },
    {
      name:   'resetBasePrompt',
      method: 'post' as const,
      run:    (store: ReturnType<typeof useLlmSettingsStore>) => store.resetBasePrompt()
    }
  ])('$name при ошибке бросает исключение', async ({ name, method, run }) => {
    vi.mocked(api[method]).mockRejectedValueOnce(new Error('Request failed'))

    const store = useLlmSettingsStore()

    await expect(run(store)).rejects.toThrow()
    name === 'fetchAll' && expect(store.settings).toHaveLength(0)
  })
})
