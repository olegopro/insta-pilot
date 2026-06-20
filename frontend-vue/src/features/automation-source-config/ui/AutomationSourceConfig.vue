<script setup lang="ts">
  import { computed } from 'vue'
  import type { Nullable } from '@/shared/lib'
  import { useSearchStore } from '@/entities/media-post'
  import type { Location } from '@/entities/media-post'
  import { SOURCE_TYPE_OPTIONS } from '@/entities/automation-parsing'
  import type { SourceConfig, SourceType } from '@/entities/automation-parsing'
  import { SegmentedControlComponent } from '@/shared/ui/segmented-control-component'
  import { ChipsInputComponent } from '@/shared/ui/chips-input-component'
  import { SelectComponent } from '@/shared/ui/select-component'

  const props = defineProps<{
    accountId: Nullable<number>
  }>()

  const model = defineModel<SourceConfig>({ required: true })

  const searchStore = useSearchStore()

  const needsHashtags = computed(() =>
    ['hashtag', 'hashtag_list', 'hashtag_location'].includes(model.value.type))

  const needsLocation = computed(() =>
    ['location', 'hashtag_location'].includes(model.value.type))

  const selectedLocation = computed<Nullable<Location>>({
    get: () => model.value.locationPk === null
      ? null
      : { pk: model.value.locationPk, name: model.value.locationName ?? '', address: '', lat: 0, lng: 0 },
    set: (location) => model.value = {
      ...model.value,
      locationPk: location?.pk ?? null,
      locationName: location?.name ?? null
    }
  })

  const updateTypeHandler = (type: SourceType) => model.value = { ...model.value, type }

  const updateHashtagsHandler = (hashtags: string[]) =>
    model.value = { ...model.value, hashtags: hashtags.map((tag) => tag.replace(/^#/, '')) }

  const locationFilterHandler = (inputVal: string, update: (fn: () => void) => void) => {
    if (!props.accountId || inputVal.length < 2) {
      update(searchStore.clearLocations)
      return
    }
    searchStore.fetchLocations(props.accountId, inputVal)
      .then(() => update(() => undefined))
      .catch(() => update(() => undefined))
  }
</script>

<template>
  <div class="source-config">
    <SegmentedControlComponent
      :model-value="model.type"
      :options="SOURCE_TYPE_OPTIONS"
      spread
      @update:model-value="updateTypeHandler"
    />

    <div class="source-config__fields q-mt-md">
      <ChipsInputComponent
        v-if="needsHashtags"
        :model-value="model.hashtags"
        label-text="Хэштеги (без #)"
        outlined
        dense
        :disable="!accountId"
        @update:model-value="updateHashtagsHandler"
      />

      <SelectComponent
        v-if="needsLocation"
        v-model="selectedLocation"
        :options="searchStore.locations"
        option-label="name"
        label="Гео-локация"
        outlined
        dense
        use-input
        clearable
        input-debounce="400"
        :loading="searchStore.locationsLoading"
        :disable="!accountId"
        @filter="locationFilterHandler"
      >
        <template #option="scope">
          <q-item v-bind="scope.itemProps">
            <q-item-section>
              <q-item-label>{{ scope.opt.name }}</q-item-label>
              <q-item-label v-if="scope.opt.address" caption>{{ scope.opt.address }}</q-item-label>
            </q-item-section>
          </q-item>
        </template>
        <template #no-option>
          <q-item>
            <q-item-section class="text-grey">Введите минимум 2 символа</q-item-section>
          </q-item>
        </template>
      </SelectComponent>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .source-config__fields {
    display: flex;
    flex-direction: column;
    gap: $spacing-stack-gap;
  }
</style>
