import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InputComponent from '@/shared/ui/input-component/InputComponent.vue'

const QInputStub = {
  name: 'QInput',
  inheritAttrs: false,
  props: ['modelValue', 'type', 'label'],
  emits: ['update:modelValue'],
  template: '<div data-q-input :data-type="type" :data-label="label"><slot name="append" /></div>'
}

const QIconStub = {
  name: 'QIcon',
  props: ['name'],
  template: '<span :data-icon="name" />'
}

const globalStubs = {
  'q-input': QInputStub,
  'q-icon': QIconStub
}

describe('InputComponent', () => {
  it('рендерит q-input', () => {
    const wrapper = mount(InputComponent, {
      global: { stubs: globalStubs }
    })
    expect(wrapper.find('[data-q-input]').exists()).toBe(true)
  })

  it('не показывает иконку для type=text', () => {
    const wrapper = mount(InputComponent, {
      props: { type: 'text' },
      global: { stubs: globalStubs }
    })
    expect(wrapper.find('[data-icon]').exists()).toBe(false)
  })

  it('показывает иконку visibility_off для type=password', () => {
    const wrapper = mount(InputComponent, {
      props: { type: 'password' },
      global: { stubs: globalStubs }
    })
    expect(wrapper.find('[data-icon]').attributes('data-icon')).toBe('visibility_off')
  })

  it('клик на иконку переключает тип поля на text', async () => {
    const wrapper = mount(InputComponent, {
      props: { type: 'password' },
      global: { stubs: globalStubs }
    })
    await wrapper.find('[data-icon]').trigger('click')
    expect(wrapper.find('[data-q-input]').attributes('data-type')).toBe('text')
  })

  it('повторный клик возвращает тип обратно на password', async () => {
    const wrapper = mount(InputComponent, {
      props: { type: 'password' },
      global: { stubs: globalStubs }
    })
    await wrapper.find('[data-icon]').trigger('click')
    await wrapper.find('[data-icon]').trigger('click')
    expect(wrapper.find('[data-q-input]').attributes('data-type')).toBe('password')
  })

  it('после переключения иконка меняется на visibility', async () => {
    const wrapper = mount(InputComponent, {
      props: { type: 'password' },
      global: { stubs: globalStubs }
    })
    await wrapper.find('[data-icon]').trigger('click')
    expect(wrapper.find('[data-icon]').attributes('data-icon')).toBe('visibility')
  })

  it('передаёт labelText как label в q-input', () => {
    const wrapper = mount(InputComponent, {
      props: { labelText: 'Email' },
      global: { stubs: globalStubs }
    })
    expect(wrapper.find('[data-q-input]').attributes('data-label')).toBe('Email')
  })
})
