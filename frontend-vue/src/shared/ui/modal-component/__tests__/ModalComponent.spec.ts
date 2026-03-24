import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ModalComponent from '@/shared/ui/modal-component/ModalComponent.vue'

const QDialogStub = {
  name: 'QDialog',
  props: ['modelValue'],
  emits: ['update:modelValue', 'hide'],
  template: `
    <div v-if="modelValue" data-q-dialog>
      <slot />
    </div>
  `
}

const QFormStub = {
  name: 'QForm',
  template: '<form><slot /></form>'
}

const globalStubs = {
  'q-dialog':   QDialogStub,
  'q-form':     QFormStub,
  'q-icon':     true,
  'ButtonComponent': {
    props: ['label', 'type'],
    template: '<button :type="type">{{ label }}</button>'
  }
}

describe('ModalComponent', () => {
  it('v-model=true показывает контент диалога', () => {
    const wrapper = mount(ModalComponent, {
      props:  { modelValue: true },
      global: { stubs: globalStubs }
    })
    expect(wrapper.find('[data-q-dialog]').exists()).toBe(true)
  })

  it('v-model=false скрывает контент диалога', () => {
    const wrapper = mount(ModalComponent, {
      props:  { modelValue: false },
      global: { stubs: globalStubs }
    })
    expect(wrapper.find('[data-q-dialog]').exists()).toBe(false)
  })

  it('пробрасывает слот default', () => {
    const wrapper = mount(ModalComponent, {
      props:  { modelValue: true },
      slots:  { default: '<span data-slot-content>Содержимое</span>' },
      global: { stubs: globalStubs }
    })
    expect(wrapper.find('[data-slot-content]').exists()).toBe(true)
  })
})
