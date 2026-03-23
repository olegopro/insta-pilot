<script setup lang="ts">
  import { computed, ref } from 'vue'
  import type { ActivityLogRowModel } from '@/entities/activity-log'
  import type { TabMode } from '@/widgets/activity-log-table/model/types'
  import {
    NESTED_REQUEST_KEYS,
    NESTED_RESPONSE_KEYS,
    extractKey,
    withoutKeys,
    hasNestedData,
    previewTooltip,
    display
  } from '@/widgets/activity-log-table/lib/responseFormatters'
  import { BadgeComponent } from '@/shared/ui/badge-component'

  interface Props {
    row: ActivityLogRowModel
  }

  const { row } = defineProps<Props>()

  // Vue ↔ Laravel
  const vueReq = computed(() => withoutKeys(row.requestPayload, NESTED_REQUEST_KEYS))
  const vueResp = computed(() => withoutKeys(row.responseSummary, NESTED_RESPONSE_KEYS))
  const showTabsVue = computed(() => hasNestedData(vueReq.value) || hasNestedData(vueResp.value))

  // Laravel ↔ Python
  const pythonReq = computed(() => extractKey(row.requestPayload, 'python_request'))
  const pythonResp = computed(() => extractKey(row.responseSummary, 'python_response'))
  const hasPython = computed(() => pythonReq.value !== null || pythonResp.value !== null)

  // Python ↔ Instagram
  const instagramReq = computed(() => extractKey(row.requestPayload, 'instagram_request'))
  const instagramResp = computed(() => extractKey(row.responseSummary, 'instagram_response'))
  const hasInstagram = computed(() => instagramReq.value !== null || instagramResp.value !== null)
  const showTabsInstagram = computed(() => hasNestedData(instagramReq.value) || hasNestedData(instagramResp.value))

  // LLM API
  const llmReq = computed(() => extractKey(row.requestPayload, 'llm_request'))
  const llmResp = computed(() => extractKey(row.responseSummary, 'llm_response'))
  const hasLlm = computed(() => llmReq.value !== null || llmResp.value !== null)

  const tabVue = ref<TabMode>('compact')
  const tabInstagram = ref<TabMode>('compact')

  const vueReqDisplay = computed(() => showTabsVue.value ? display(vueReq.value, tabVue.value) : vueReq.value)
  const vueRespDisplay = computed(() => showTabsVue.value ? display(vueResp.value, tabVue.value) : vueResp.value)
  const instagramReqDisplay = computed(() => showTabsInstagram.value ? display(instagramReq.value, tabInstagram.value) : instagramReq.value)
  const instagramRespDisplay = computed(() => showTabsInstagram.value ? display(instagramResp.value, tabInstagram.value) : instagramResp.value)
</script>

<template>
  <div class="expanded-row-content q-pa-md">
    <div class="detail-header text-grey q-mb-md">
      Детали запроса #{{ row.id }}
      <span v-if="row.durationFormatted" class="q-ml-sm">· {{ row.durationFormatted }}</span>
      <span v-if="row.errorCode" class="q-ml-sm text-negative">· {{ row.errorCode }}</span>
    </div>

    <div class="row q-gutter-md">
      <!-- Секция 1: Vue ↔ Laravel -->
      <div class="col-12 col-md">
        <div class="section-header">
          <span class="section-label text-blue-grey-7">Vue ↔ Laravel</span>
          <div v-if="showTabsVue" class="tab-switcher">
            <button :class="['tab-btn', tabVue === 'compact' && 'tab-btn--active']" @click="tabVue = 'compact'">Кратко</button>
            <button :class="['tab-btn', tabVue === 'full' && 'tab-btn--active']" @click="tabVue = 'full'">Подробно</button>
          </div>
        </div>

        <div class="q-mb-sm">
          <div class="field-label">Request{{ row.endpoint ? ` → ${row.endpoint}` : '' }}</div>
          <pre v-if="vueReqDisplay" class="log-json">{{ JSON.stringify(vueReqDisplay, null, 2) }}</pre>
          <span v-else class="text-caption text-grey">—</span>
        </div>

        <div>
          <div class="field-label">
            Response
            <BadgeComponent v-if="row.httpCode" :color="row.httpCodeColor" :label="String(row.httpCode)" size="sm" class="q-ml-xs" />
            <q-icon v-if="previewTooltip(vueResp)" name="info" size="16px" color="grey-5" class="q-ml-xs cursor-pointer">
              <q-tooltip max-width="260px">{{ previewTooltip(vueResp) }}</q-tooltip>
            </q-icon>
          </div>
          <pre v-if="vueRespDisplay" class="log-json">{{ JSON.stringify(vueRespDisplay, null, 2) }}</pre>
          <div v-if="row.errorMessage" class="text-negative text-caption q-mt-xs">{{ row.errorMessage }}</div>
          <span v-if="!vueRespDisplay && !row.errorMessage" class="text-caption text-grey">—</span>
        </div>
      </div>

      <!-- Секция 2: Laravel ↔ Python (без табов — данные уже компактные) -->
      <div v-if="hasPython" class="col-12 col-md">
        <div class="section-header">
          <span class="section-label text-teal-7">Laravel ↔ Python</span>
        </div>

        <div v-if="pythonReq" class="q-mb-sm">
          <div class="field-label">Request</div>
          <pre class="log-json">{{ JSON.stringify(pythonReq, null, 2) }}</pre>
        </div>

        <div v-if="pythonResp">
          <div class="field-label">
            Response
            <BadgeComponent
              v-if="pythonResp.http_code"
              :color="(pythonResp.http_code as number) < 400 ? 'positive' : 'negative'"
              :label="String(pythonResp.http_code)"
              size="sm"
              class="q-ml-xs"
            />
          </div>
          <pre class="log-json">{{ JSON.stringify(pythonResp, null, 2) }}</pre>
        </div>
      </div>

      <!-- Секция 3: Python ↔ Instagram или LLM API -->
      <div v-if="hasInstagram || hasLlm" class="col-12 col-md">
        <!-- Python ↔ Instagram -->
        <template v-if="hasInstagram">
          <div class="section-header">
            <span class="section-label text-orange-8">Python ↔ Instagram API</span>
            <div v-if="showTabsInstagram" class="tab-switcher">
              <button :class="['tab-btn', tabInstagram === 'compact' && 'tab-btn--active']" @click="tabInstagram = 'compact'">Кратко</button>
              <button :class="['tab-btn', tabInstagram === 'full' && 'tab-btn--active']" @click="tabInstagram = 'full'">Подробно</button>
            </div>
          </div>

          <div v-if="instagramReq" class="q-mb-sm">
            <div class="field-label">Request</div>
            <pre class="log-json">{{ JSON.stringify(instagramReqDisplay, null, 2) }}</pre>
          </div>

          <div v-if="instagramResp">
            <div class="field-label">
              Response
              <BadgeComponent
                v-if="instagramResp.status"
                :color="instagramResp.status === 'ok' ? 'positive' : 'negative'"
                :label="String(instagramResp.status)"
                size="sm"
                class="q-ml-xs"
              />
              <q-icon v-if="previewTooltip(instagramResp)" name="info" size="16px" color="grey-5" class="q-ml-xs cursor-pointer">
                <q-tooltip max-width="260px">{{ previewTooltip(instagramResp) }}</q-tooltip>
              </q-icon>
            </div>
            <pre class="log-json">{{ JSON.stringify(instagramRespDisplay, null, 2) }}</pre>
          </div>
        </template>

        <!-- LLM API (без табов — всегда полная детализация) -->
        <template v-if="hasLlm">
          <div class="section-label text-deep-orange-8 q-mb-sm">LLM API</div>

          <div v-if="llmReq" class="q-mb-sm">
            <div class="field-label">Request</div>
            <pre class="log-json">{{ JSON.stringify(llmReq, null, 2) }}</pre>
          </div>

          <div v-if="llmResp">
            <div class="field-label">Response</div>
            <pre class="log-json">{{ JSON.stringify(llmResp, null, 2) }}</pre>
          </div>
        </template>
      </div>
    </div>

    <div class="row q-gutter-lg q-mt-sm detail-footer text-grey">
      <span>Создан: <strong>{{ row.createdAt }}</strong></span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $indent-sm;
}

.section-label {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tab-switcher {
  display: flex;
  gap: $indent-xs;
}

.tab-btn {
  font-size: $font-size-sm;
  padding: $indent-xs $indent-sm;
  border: $border-width-default $border-style-default $neutral-300;
  background: $surface-primary;
  border-radius: $radius-sm;
  cursor: pointer;
  color: $content-secondary;
  line-height: 1.6;
}

.tab-btn:hover:not(.tab-btn--active) {
  background: $neutral-100;
  border-color: $neutral-300;
}

.tab-btn--active {
  background: $primary;
  border-color: $primary;
  color: $surface-primary;
}

.field-label {
  font-size: $font-size-sm;
  color: $content-secondary;
  margin-bottom: $indent-s;
}

.detail-header {
  font-size: $font-size-base;
}

.detail-footer {
  font-size: $font-size-sm;
}

.expanded-row-content {
  background: rgba(0, 0, 0, 0.025);
  margin: $indent-s $indent-sm $indent-sm;
  border: 1px solid $border-default;
  border-radius: $radius-lg;
}

.log-json {
  font-size: $font-size-sm;
  background: $surface-primary;
  border: $border-width-default $border-style-default $border-table;
  padding: $indent-sm;
  border-radius: $radius-md;
  overflow-x: auto;
  margin: 0 0 $spacing-stack-gap;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
