import { computed, getCurrentInstance, type ComputedRef } from 'vue'

const toKebabCase = (str: string) => str.replace(/([A-Z])/g, '-$1').toLowerCase()

/**
 * Возвращает только те пропсы, которые родитель **явно передал** компоненту.
 *
 * Использует `vnode.props` текущего инстанса — там хранятся пропсы без
 * Vue-кастинга (boolean `undefined → false`). Ключи проверяются в camelCase
 * и kebab-case вариантах.
 *
 * Применяется в wrapper-компонентах вместо `v-bind="$props"`:
 * ```vue
 * const forwarded = useForwardProps(props)
 * // в шаблоне:
 * <q-input v-bind="{ ...$attrs, ...forwarded }" />
 * ```
 *
 * ## Partial<T> и required-пропсы
 * `useForwardProps` возвращает `Partial<T>` — TypeScript не может знать, какие пропсы
 * реально передал родитель. Возврат `T` вместо `Partial<T>` ломает `exactOptionalPropertyTypes`.
 *
 * Для компонентов с required-пропсами (кроме `modelValue`) нужен cast в шаблоне:
 * ```html
 * <q-table v-bind="{ ...$attrs, ...forwarded as QTableProps }" />
 * ```
 *
 * Quasar-компоненты с required-пропсами:
 * | Компонент          | Required-пропсы    |
 * |--------------------|--------------------|
 * | QTableProps        | `rows`             |
 * | QTreeProps         | `nodes`, `nodeKey` |
 * | QVideoProps        | `src`              |
 * | QPaginationProps   | `max`              |
 * | QStepProps         | `name`, `title`    |
 * | QTabPanelProps     | `name`             |
 * | QCarouselSlideProps| `name`             |
 * | QRadioProps        | `val`              |
 *
 * Все остальные (QInput, QSelect, QBtn, QToggle и др.) — cast не нужен.
 *
 * @see https://www.radix-vue.com/utilities/use-forward-props (оригинальная идея)
 * @see https://github.com/vuejs/core/discussions/8508 (обсуждение проблемы)
 */
export function useForwardProps<T extends Record<string, unknown>>(
  props: T
): ComputedRef<Partial<T>> {
  const instance = getCurrentInstance()

  return computed(() => {
    const vnodeProps = instance?.vnode.props ?? {}
    const result: Record<string, unknown> = {}

    for (const key in props) {
      if (key in vnodeProps || toKebabCase(key) in vnodeProps) {
        result[key] = props[key]
      }
    }

    return result as Partial<T>
  })
}
