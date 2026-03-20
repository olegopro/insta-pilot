<script setup lang="ts">
  import { ref } from 'vue'
  import { useAccountStore } from '@/entities/instagram-account/model/accountStore'
  import type { InstagramAccount } from '@/entities/instagram-account/model/types'
  import type { Nullable } from '@/shared/lib'
  import { proxyImageUrl } from '@/shared/lib'
  import { SelectComponent } from '@/shared/ui/select-component'

  interface Props {
    stackLabel?: boolean
    loading?: boolean
  }

  defineOptions({ inheritAttrs: false })
  defineProps<Props>()
  const model = defineModel<Nullable<InstagramAccount>>()

  const accountStore = useAccountStore()
  const selectRef = ref<InstanceType<typeof SelectComponent>>()

  defineExpose({ blur: () => selectRef.value?.blur() })
</script>

<template>
  <SelectComponent
    ref="selectRef"
    v-bind="$attrs"
    v-model="model"
    :options="accountStore.accounts"
    :loading="accountStore.fetchAccountsLoading || loading"
    :stack-label="stackLabel"
    option-label="instagram_login"
    label="Выберите аккаунт"
    clearable
    outlined
    dense
    style="min-width: 230px"
    emit-value
    map-options
  >
    <template #option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section avatar>
          <q-avatar size="32px">
            <img v-if="scope.opt.profile_pic_url" :src="proxyImageUrl(scope.opt.profile_pic_url) ?? undefined">
            <q-icon v-else name="person" />
          </q-avatar>
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ scope.opt.instagram_login }}</q-item-label>
          <q-item-label v-if="scope.opt.full_name" caption>{{ scope.opt.full_name }}</q-item-label>
        </q-item-section>
      </q-item>
    </template>
  </SelectComponent>
</template>
