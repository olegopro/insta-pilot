import { computed, type ComputedRef } from 'vue'


/**
 * Composable для безопасного проброса props в дочерний Quasar-компонент.
 *
 * ## Проблема
 * При создании wrapper-компонента (например, InputComponent → QInput)
 * с `defineProps<ExtendedInterface>()` + `v-bind="$props"` возникает
 * проблема boolean-кастинга Vue:
 *
 * Vue автоматически преобразует все **необъявленные** boolean-пропсы
 * из `undefined` в `false`. Если QInput имеет 30+ boolean-пропсов
 * (`outlined`, `dense`, `filled`, `borderless`, `hideBottomSpace` ...),
 * обёртка передаёт `outlined: false` в QInput — даже если родитель
 * **не указывал** `outlined` вообще. Это перезатирает дефолтное
 * поведение дочернего компонента.
 *
 * ## Решение
 * `useForwardProps` фильтрует props-объект: возвращает только те
 * свойства, значение которых !== `undefined`. Неуказанные boolean-пропсы
 * не попадают в результат, и дочерний компонент использует свои дефолты.
 *
 * `$attrs` добавляется в шаблоне через spread: `v-bind="{ ...$attrs, ...forwarded }"`
 * для проброса нативных HTML-атрибутов (`class`, `autocomplete`),
 * которые не входят в типы дочернего компонента.
 *
 * ## Использование
 * ```vue
 * <script setup lang="ts">
 * import { useForwardProps } from '@/shared/lib'
 *
 * interface Props extends Omit<QInputProps, 'modelValue'> {
 *   labelText?: string
 * }
 * const props = defineProps<Props>()
 * const forwarded = useForwardProps(props)
 * </script>
 *
 * <template>
 *   <q-input v-bind="{ ...$attrs, ...forwarded }" />
 * </template>
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
  return computed(() => {
    const result: Record<string, unknown> = {}

    for (const key in props) {
      if (props[key] !== undefined) {
        result[key] = props[key]
      }
    }

    return result as Partial<T>
  })
}
