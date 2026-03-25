import { describe, it, expect } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useForwardProps } from '@/shared/lib/useForwardProps'

const makeWrapper = (propsDefinition: Record<string, unknown>, passedProps: Record<string, unknown>) => {
  const Inner = defineComponent({
    props: Object.fromEntries(
      Object.keys(propsDefinition).map((key) => [key, { default: undefined }])
    ) as Record<string, { default: undefined }>,
    setup(props) {
      const forwarded = useForwardProps(props as Record<string, unknown>)
      return { forwarded }
    },
    render() { return h('div') }
  })

  return mount(Inner, { props: passedProps as unknown as Record<string, undefined> })
}

describe('useForwardProps', () => {
  it('пробрасывает явно переданные пропсы', () => {
    const wrapper = makeWrapper(
      { label: undefined, placeholder: undefined },
      { label: 'Имя' }
    )
    // Vue unwrap'ит ComputedRef при возврате из setup() — доступ без .value
    const forwarded = (wrapper.vm as unknown as { forwarded: Record<string, unknown> }).forwarded
    expect(forwarded.label).toBe('Имя')
  })

  it('не включает пропсы, которые не были переданы', () => {
    const wrapper = makeWrapper(
      { label: undefined, placeholder: undefined },
      { label: 'Имя' }
    )
    const forwarded = (wrapper.vm as unknown as { forwarded: Record<string, unknown> }).forwarded
    expect('placeholder' in forwarded).toBe(false)
  })

  it('пробрасывает boolean false (не фильтрует falsy)', () => {
    const wrapper = makeWrapper(
      { disabled: undefined },
      { disabled: false }
    )
    const forwarded = (wrapper.vm as unknown as { forwarded: Record<string, unknown> }).forwarded
    expect(forwarded.disabled).toBe(false)
    expect('disabled' in forwarded).toBe(true)
  })

  it('пробрасывает числовой 0', () => {
    const wrapper = makeWrapper(
      { maxLength: undefined },
      { maxLength: 0 }
    )
    const forwarded = (wrapper.vm as unknown as { forwarded: Record<string, unknown> }).forwarded
    expect(forwarded.maxLength).toBe(0)
    expect('maxLength' in forwarded).toBe(true)
  })
})
