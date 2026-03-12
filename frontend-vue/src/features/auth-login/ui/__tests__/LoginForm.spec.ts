import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@/entities/user', () => ({
  useAuthStore: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: vi.fn()
}))

vi.mock('@/shared/lib', () => ({
  notifyError: vi.fn()
}))

import LoginForm from '../LoginForm.vue'
import { useAuthStore } from '@/entities/user'
import { useRouter } from 'vue-router'
import { notifyError } from '@/shared/lib'

const mockLogin = vi.fn()
const mockPush = vi.fn()

const createStore = (overrides: Record<string, unknown> = {}) => ({
  login: mockLogin,
  loginLoading: false,
  loginError: null,
  ...overrides
})

const globalStubs = {
  'q-form': {
    template: '<form @submit.prevent="$emit(\'submit\')"><slot /></form>',
    emits: ['submit']
  },
  InputComponent: {
    props: ['modelValue', 'type', 'labelText'],
    emits: ['update:modelValue'],
    template: '<input :type="type" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
  },
  ButtonComponent: {
    props: ['loading', 'type'],
    template: '<button :type="type || \'button\'" :data-loading="loading || undefined"><slot /></button>'
  }
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>)
  })

  it('рендерит поля email и password', () => {
    vi.mocked(useAuthStore).mockReturnValue(createStore() as unknown as ReturnType<typeof useAuthStore>)

    const wrapper = mount(LoginForm, { global: { stubs: globalStubs } })

    const inputs = wrapper.findAll('input')
    expect(inputs.some((input) => input.attributes('type') === 'email')).toBe(true)
    expect(inputs.some((input) => input.attributes('type') === 'password')).toBe(true)
  })

  it('submitHandler вызывает authStore.login с email и password', async () => {
    mockLogin.mockResolvedValueOnce(undefined)
    vi.mocked(useAuthStore).mockReturnValue(createStore() as unknown as ReturnType<typeof useAuthStore>)

    const wrapper = mount(LoginForm, { global: { stubs: globalStubs } })

    await wrapper.find('input[type="email"]').setValue('test@example.com')
    await wrapper.find('input[type="password"]').setValue('secret123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mockLogin).toHaveBeenCalledWith({ email: 'test@example.com', password: 'secret123' })
  })

  it('при успешном логине вызывает router.push("/")', async () => {
    mockLogin.mockResolvedValueOnce(undefined)
    vi.mocked(useAuthStore).mockReturnValue(createStore() as unknown as ReturnType<typeof useAuthStore>)

    const wrapper = mount(LoginForm, { global: { stubs: globalStubs } })

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('при ошибке вызывает notifyError', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Unauthorized'))
    vi.mocked(useAuthStore).mockReturnValue(
      createStore({ loginError: 'Неверный пароль' }) as unknown as ReturnType<typeof useAuthStore>
    )

    const wrapper = mount(LoginForm, { global: { stubs: globalStubs } })

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(notifyError).toHaveBeenCalledWith('Неверный пароль')
  })

  it('кнопка показывает состояние loading', () => {
    vi.mocked(useAuthStore).mockReturnValue(
      createStore({ loginLoading: true }) as unknown as ReturnType<typeof useAuthStore>
    )

    const wrapper = mount(LoginForm, { global: { stubs: globalStubs } })

    expect(wrapper.find('button').attributes('data-loading')).toBe('true')
  })
})
