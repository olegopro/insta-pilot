<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useLlmSettingsStore, PROVIDERS, MODELS_BY_PROVIDER, TONES } from '@/entities/llm-settings'
  import type { LlmSetting, LlmProvider, LlmTone, LlmSettingFormData } from '@/entities/llm-settings'
  import { InputComponent } from '@/shared/ui/input-component'
  import { SelectComponent } from '@/shared/ui/select-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { ToggleComponent } from '@/shared/ui/toggle-component'
  import { notifySuccess, notifyError } from '@/shared/lib'
  import type { Nullable } from '@/shared/lib'

  const store = useLlmSettingsStore()

  const showForm = ref(false)

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

  const onProviderChange = () => {
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

  const deleteHandler = (id: number) => {
    store.deleteSetting(id)
      .then(() => notifySuccess('Провайдер удалён'))
      .catch(() => notifyError('Ошибка удаления'))
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
  <q-page padding>
    <div class="text-h5 q-mb-lg">Настройки LLM</div>

    <q-list bordered separator class="rounded-borders q-mb-lg">
      <q-item v-for="setting in store.settings" :key="setting.id" class="q-pa-md">
        <q-item-section>
          <q-item-label class="text-weight-bold text-subtitle1">
            {{ providerLabel(setting.provider) }}
            <q-badge v-if="setting.isDefault" color="primary" class="q-ml-sm">По умолчанию</q-badge>
          </q-item-label>
          <q-item-label caption>
            Модель: {{ setting.modelName }} · Тон: {{ setting.tone }} · Описание: {{ setting.useCaption ? 'да' : 'нет' }}
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <div class="row q-gutter-sm">
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
              @click="deleteHandler(setting.id)"
            />
          </div>
        </q-item-section>
      </q-item>

      <q-item v-if="store.settings.length === 0 && !store.fetchAllLoading">
        <q-item-section class="text-grey-6 text-center q-py-md">
          Провайдеры не настроены
        </q-item-section>
      </q-item>
    </q-list>

    <ButtonComponent
      v-if="!showForm"
      icon="add"
      label="Добавить провайдер"
      @click="showForm = true"
    />

    <q-card v-if="showForm" class="q-mt-md" style="max-width: 600px">
      <q-card-section>
        <div class="text-h6">{{ form.provider ? providerLabel(form.provider) : 'Новый провайдер' }}</div>
      </q-card-section>

      <q-card-section class="q-gutter-md">
        <SelectComponent
          v-model="form.provider"
          label="Провайдер"
          :options="PROVIDERS"
          option-value="value"
          option-label="label"
          emit-value
          map-options
          @update:model-value="onProviderChange"
        />

        <InputComponent
          v-model="form.apiKey"
          label-text="API Key"
          type="password"
          :placeholder="`Введите ключ ${providerLabel(form.provider)}`"
        />

        <SelectComponent
          v-model="form.modelName"
          label="Модель"
          :options="modelOptions"
          option-value="value"
          option-label="label"
          emit-value
          map-options
        />

        <SelectComponent
          v-model="form.tone"
          label="Тон комментариев"
          :options="TONES"
          option-value="value"
          option-label="label"
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
          autogrow
        />
      </q-card-section>

      <q-card-section>
        <ButtonComponent
          flat
          icon="bolt"
          label="Тест подключения"
          :loading="store.testConnectionLoading"
          @click="testHandler"
        />
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <ButtonComponent
          flat
          label="Отмена"
          @click="showForm = false; resetForm()"
        />
        <ButtonComponent
          label="Сохранить"
          :loading="store.saveSettingLoading"
          @click="saveHandler"
        />
      </q-card-actions>
    </q-card>
  </q-page>
</template>
