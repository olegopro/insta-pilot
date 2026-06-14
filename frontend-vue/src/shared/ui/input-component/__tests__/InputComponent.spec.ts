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
  it('показывает иконку visibility_off для type=password', () => {
    const wrapper = mount(InputComponent, {
      props: { type: 'password' },
      global: { stubs: globalStubs }
    })
    expect(wrapper.find('[data-icon]').attributes('data-icon')).toBe('visibility_off')
  })

  it.each([
    [1, 'text', 'visibility'],
    [2, 'password', 'visibility_off'],
    [3, 'text', 'visibility']
  ])('после %i клик(ов) тип=%s, иконка=%s', async (clicks, expectedType, expectedIcon) => {
    const wrapper = mount(InputComponent, {
      props: { type: 'password' },
      global: { stubs: globalStubs }
    })

    for (let click = 0; click < clicks; click++) {
      await wrapper.find('[data-icon]').trigger('click')
    }

    expect(wrapper.find('[data-q-input]').attributes('data-type')).toBe(expectedType)
    expect(wrapper.find('[data-icon]').attributes('data-icon')).toBe(expectedIcon)
  })
})
