# Frontend Patterns

## shared/ui — обёртка над Quasar-компонентами

```vue
<script setup lang="ts">
import { ref, useAttrs } from 'vue'
import type { QInputProps, QInputSlots } from 'quasar'
import { QInput } from 'quasar'

export interface InputComponentProps {
  labelText?: string
}

defineOptions({ inheritAttrs: false })
defineProps<InputComponentProps>()
defineSlots<QInputSlots>()
defineExpose({ validate: () => qInputRef.value?.validate() })

const attrs = useAttrs() as Omit<QInputProps, 'modelValue'>
const qInputRef = ref<QInput>()
const model = defineModel<QInputProps['modelValue']>()
</script>

<template>
  <label>
    <q-input v-bind="$attrs" v-model="model">
      <template v-for="(_, name) in $slots" #[name]="scope">
        <slot :name="name" v-bind="scope || {}" />
      </template>
    </q-input>
  </label>
</template>
```

Ключевые моменты:
- `inheritAttrs: false` + `v-bind="$attrs"` — прозрачная обёртка
- `useAttrs() as Omit<QInputProps, 'modelValue'>` — типизация без дублирования
- `defineModel` — двусторонний бинд
- slots proxy через `v-for` по `$slots`
- `export interface XxxProps` + реэкспорт через `index.ts`

## useApi composable

```ts
const store = defineStore('name', () => {
  const login = useApi(async (params?: LoginRequest) =>
    (await api.post<ApiResponseWrapper<LoginResponse>>('accounts/login', params)).data
  )
  return { login }
})
// Использование: store.login.execute(params), store.login.loading, store.login.data
```
