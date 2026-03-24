<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
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

  const basePromptEdit = ref<string>('')
  const basePromptDirty = computed(() => basePromptEdit.value !== (store.basePrompt ?? ''))

  watch(() => store.basePrompt, (value) => basePromptEdit.value = value ?? '')

  const saveBasePromptHandler = () => store.updateBasePrompt(basePromptEdit.value)
    .then(() => notifySuccess('Базовый промпт сохранён'))
    .catch(() => notifyError('Ошибка сохранения'))

  const resetBasePromptHandler = () => store.resetBasePrompt()
    .then(() => {
      basePromptEdit.value = store.basePrompt ?? ''
      notifySuccess('Базовый промпт сброшен до дефолтного')
    })
    .catch(() => notifyError('Ошибка сброса'))

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

  const setDefaultHandler = (id: number) => store.setDefault(id)
    .then(() => notifySuccess('Провайдер по умолчанию обновлён'))
    .catch(() => notifyError('Ошибка'))

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

  const resetForm = () => form.value = {
    provider: 'glm',
    apiKey: '',
    modelName: 'glm-4.6v-flash',
    systemPrompt: null,
    tone: 'friendly',
    useCaption: true
  }

  const providerLabel = (provider: LlmProvider) =>
    PROVIDERS.find((option) => option.value === provider)?.label ?? provider

  onMounted(() => {
    void store.fetchAll()
    void store.fetchBasePrompt()
  })
</script>

<template>
  <PageComponent title="Настройки LLM" icon="smart_toy">
    <div class="list q-mb-lg">
      <div
        v-for="setting in store.settings"
        :key="setting.id"
        class="item"
      >
        <div class="info">
          <div class="text-weight-medium text-subtitle1 name">
            {{ providerLabel(setting.provider) }}
            <BadgeComponent v-if="setting.isDefault" color="primary" label="По умолчанию" size="lg" />
          </div>
          <div class="text-caption text-grey-6">
            Модель: {{ setting.modelName }} · Тон: {{ setting.tone }} · Описание: {{ setting.useCaption ? 'да' : 'нет' }}
          </div>
        </div>

        <div class="actions">
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
            icon-scale="lg"
            icon="edit"
            @click="editHandler(setting)"
          />
          <ButtonComponent
            flat
            dense
            icon-scale="lg"
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
      style="align-self: flex-start"
      @click="showForm = true"
    />

    <CardComponent v-if="showForm" class="form">
      <CardSectionComponent class="q-pb-sm">
        <div class="text-h6">{{ form.provider ? providerLabel(form.provider) : 'Новый провайдер' }}</div>
      </CardSectionComponent>

      <CardSectionComponent class="fields">
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

        <div class="base-prompt">
          <div class="base-prompt__header">
            <span class="text-caption text-grey-6">Базовый системный промпт</span>
            <div class="row items-center q-gutter-xs">
              <BadgeComponent v-if="store.basePromptIsModified" color="warning" label="Изменён" size="sm" />
              <ButtonComponent
                flat
                dense
                size="sm"
                icon="restart_alt"
                color="grey-6"
                :loading="store.resetBasePromptLoading"
                :disable="!store.basePromptIsModified"
                @click="resetBasePromptHandler"
              />
              <ButtonComponent
                v-if="basePromptDirty"
                flat
                dense
                size="sm"
                icon="check"
                color="positive"
                :loading="store.updateBasePromptLoading"
                @click="saveBasePromptHandler"
              />
            </div>
          </div>
          <InputComponent
            v-model="basePromptEdit"
            type="textarea"
            outlined
            autogrow
            :loading="store.fetchBasePromptLoading"
          />
        </div>

        <InputComponent
          v-model="form.systemPrompt"
          label-text="Дополнительный системный промпт (опционально)"
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
$form-max-width: 700px;

.list {
  max-width: $form-max-width;
  display: flex;
  flex-direction: column;
  gap: $indent-s;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $indent-m $indent-ml;
  background: $surface-primary;
  border: $border-width-default $border-style-default $border-default;
  border-radius: $radius-lg;
  box-shadow: $elevation-card;
  gap: $indent-m;

  .name {
    display: flex;
    align-items: center;
    gap: $indent-s;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: $indent-xs;
    flex-shrink: 0;
  }
}

.form {
  max-width: $form-max-width;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: $indent-m;
}

.base-prompt {
  display: flex;
  flex-direction: column;
  gap: $indent-xs;

  .base-prompt__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
}
</style>
