<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useLlmSettingsStore, PROVIDERS, MODELS_BY_PROVIDER, TONES } from '@/entities/llm-settings'
  import type { LlmSetting, LlmProvider, LlmTone, LlmSettingFormData } from '@/entities/llm-settings'
  import { InputComponent } from '@/shared/ui/input-component'
  import { SelectComponent } from '@/shared/ui/select-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { ToggleComponent } from '@/shared/ui/toggle-component'
  import { BadgeComponent } from '@/shared/ui/badge-component'
  import { notifySuccess, notifyError } from '@/shared/lib'
  import { PageComponent } from '@/shared/ui/page-component'
  import { CardComponent, CardSectionComponent, CardActionsComponent } from '@/shared/ui/card-component'
  import type { Nullable } from '@/shared/lib'
  import { DeleteLlmSettingModal } from '@/features/delete-llm-setting'

  const store = useLlmSettingsStore()

  const showForm = ref(false)
  const settingToDelete = ref<LlmSetting | null>(null)
  const showDeleteModal = ref(false)

  const form = ref<{
    provider: LlmProvider
    apiKey: string
    modelName: string
    systemPrompt: Nullable<string>
    tone: LlmTone
    useCaption: boolean
  }>({
    provider: 'glm',
    apiKey: '',
    modelName: 'glm-4.6v-flash',
    systemPrompt: null,
    tone: 'friendly',
    useCaption: true
  })

  const modelOptions = computed(() => MODELS_BY_PROVIDER[form.value.provider])

  const providerChangeHandler = () => {
    const first = MODELS_BY_PROVIDER[form.value.provider][0]
    form.value.modelName = first?.value ?? ''
  }

  const saveHandler = () => {
    const data: LlmSettingFormData = {
      provider: form.value.provider,
      apiKey: form.value.apiKey,
      modelName: form.value.modelName,
      systemPrompt: form.value.systemPrompt,
      tone: form.value.tone,
      useCaption: form.value.useCaption
    }

    store.saveSetting(data)
      .then(() => {
        notifySuccess('Настройки сохранены')
        showForm.value = false
        resetForm()
      })
      .catch(() => notifyError(store.saveSettingError ?? 'Ошибка сохранения'))
  }

  const setDefaultHandler = (id: number) => {
    store.setDefault(id)
      .then(() => notifySuccess('Провайдер по умолчанию обновлён'))
      .catch(() => notifyError('Ошибка'))
  }

  const deleteHandler = (setting: LlmSetting) => {
    settingToDelete.value = setting
    showDeleteModal.value = true
  }

  const editHandler = async (setting: LlmSetting) => {
    form.value.provider = setting.provider
    form.value.apiKey = ''
    form.value.modelName = setting.modelName
    form.value.systemPrompt = setting.systemPrompt
    form.value.tone = setting.tone
    form.value.useCaption = setting.useCaption
    showForm.value = true

    const { data } = await store.fetchOne(setting.id)
    form.value.apiKey = data.api_key
  }

  const testHandler = () => {
    if (!form.value.apiKey) {
      notifyError('Введите API ключ')
      return
    }

    store.testConnection(form.value.provider, form.value.apiKey, form.value.modelName)
      .then(() => notifySuccess('Подключение успешно!'))
      .catch(() => notifyError(store.testConnectionError ?? 'Ошибка подключения'))
  }

  const resetForm = () => {
    form.value = {
      provider: 'glm',
      apiKey: '',
      modelName: 'glm-4.6v-flash',
      systemPrompt: null,
      tone: 'friendly',
      useCaption: true
    }
  }

  const providerLabel = (provider: LlmProvider) =>
    PROVIDERS.find((option) => option.value === provider)?.label ?? provider

  onMounted(() => store.fetchAll())
</script>

<template>
  <PageComponent title="Настройки LLM" icon="smart_toy">
    <div class="llm-list q-mb-lg" style="max-width: 640px">
      <div
        v-for="setting in store.settings"
        :key="setting.id"
        class="llm-item"
      >
        <div class="llm-item__info">
          <div class="text-weight-medium text-subtitle1 provider-name">
            {{ providerLabel(setting.provider) }}
            <BadgeComponent v-if="setting.isDefault" color="primary" label="По умолчанию" size="lg" />
          </div>
          <div class="text-caption text-grey-6">
            Модель: {{ setting.modelName }} · Тон: {{ setting.tone }} · Описание: {{ setting.useCaption ? 'да' : 'нет' }}
          </div>
        </div>

        <div class="llm-item__actions">
          <ButtonComponent
            v-if="!setting.isDefault"
            flat
            dense
            icon="star_outline"
            label="По умолчанию"
            :loading="store.setDefaultLoading"
            @click="setDefaultHandler(setting.id)"
          />
          <ButtonComponent
            flat
            dense
            icon="edit"
            @click="editHandler(setting)"
          />
          <ButtonComponent
            flat
            dense
            color="negative"
            icon="delete"
            @click="deleteHandler(setting)"
          />
        </div>
      </div>

      <div v-if="store.settings.length === 0 && !store.fetchAllLoading" class="text-grey-6 text-center q-py-lg">
        Провайдеры не настроены
      </div>
    </div>

    <ButtonComponent
      v-if="!showForm"
      icon="add"
      label="Добавить провайдер"
      color="primary"
      @click="showForm = true"
    />

    <CardComponent v-if="showForm" class="llm-form q-mt-lg" style="max-width: 640px">
      <CardSectionComponent class="q-pb-sm">
        <div class="text-h6">{{ form.provider ? providerLabel(form.provider) : 'Новый провайдер' }}</div>
      </CardSectionComponent>

      <CardSectionComponent class="llm-form__fields">
        <SelectComponent
          v-model="form.provider"
          label="Провайдер"
          :options="PROVIDERS"
          option-value="value"
          option-label="label"
          outlined
          emit-value
          map-options
          @update:model-value="providerChangeHandler"
        />

        <InputComponent
          v-model="form.apiKey"
          label-text="API Key"
          type="password"
          outlined
          :placeholder="`Введите ключ ${providerLabel(form.provider)}`"
        />

        <SelectComponent
          v-model="form.modelName"
          label="Модель"
          :options="modelOptions"
          option-value="value"
          option-label="label"
          outlined
          emit-value
          map-options
        />

        <SelectComponent
          v-model="form.tone"
          label="Тон комментариев"
          :options="TONES"
          option-value="value"
          option-label="label"
          outlined
          emit-value
          map-options
        />

        <ToggleComponent
          v-model="form.useCaption"
          label="Передавать описание поста в LLM"
        />

        <InputComponent
          v-model="form.systemPrompt"
          label-text="Системный промпт (опционально)"
          type="textarea"
          outlined
          autogrow
        />
      </CardSectionComponent>

      <CardActionsComponent class="q-pa-md q-pt-none" style="gap: 8px; flex-wrap: wrap">
        <ButtonComponent
          outline
          icon="bolt"
          label="Тест подключения"
          color="positive"
          :loading="store.testConnectionLoading"
          @click="testHandler"
        />
        <q-space />
        <ButtonComponent
          flat
          icon="close"
          label="Отмена"
          color="grey-7"
          @click="showForm = false; resetForm()"
        />
        <ButtonComponent
          icon="check"
          label="Сохранить"
          color="primary"
          :loading="store.saveSettingLoading"
          @click="saveHandler"
        />
      </CardActionsComponent>
    </CardComponent>
    <DeleteLlmSettingModal
      v-if="settingToDelete"
      v-model="showDeleteModal"
      :setting="settingToDelete"
    />
  </PageComponent>
</template>

<style scoped lang="scss">
.llm-list {
  display: flex;
  flex-direction: column;
  gap: $indent-s;
}

.llm-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $indent-m $indent-ml;
  background: $surface-primary;
  border: $border-width-default $border-style-default $border-default;
  border-radius: $radius-lg;
  box-shadow: $elevation-card;
  gap: $indent-m;

  &__info {
    & > .provider-name {
      display: flex;
      align-items: center;
      gap: $indent-s;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: $indent-xs;
    flex-shrink: 0;
  }
}

.llm-form {
  &__fields {
    display: flex;
    flex-direction: column;
    gap: $indent-m;
  }
}
</style>
