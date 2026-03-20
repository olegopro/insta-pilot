<script setup lang="ts">
  import { computed, ref } from 'vue'
  import type { Nullable } from '@/shared/lib'
  import type { ActivityLogRowModel } from '@/entities/activity-log'
  import { BadgeComponent } from '@/shared/ui/badge-component'

  interface Props {
    row: ActivityLogRowModel
  }

  const { row } = defineProps<Props>()

  type JsonObj = Record<string, unknown>
  type TabMode = 'compact' | 'full'

  const NESTED_REQUEST_KEYS = ['python_request', 'instagram_request', 'llm_request']
  const NESTED_RESPONSE_KEYS = ['python_response', 'instagram_response', 'llm_response']

  function extractKey(obj: Nullable<JsonObj>, key: string): Nullable<JsonObj> {
    if (!obj) return null
    const val = obj[key]
    return val && typeof val === 'object' && !Array.isArray(val) ? (val as JsonObj) : null
  }

  function withoutKeys(obj: Nullable<JsonObj>, keys: string[]): Nullable<JsonObj> {
    if (!obj) return null
    const result = Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)))
    return Object.keys(result).length > 0 ? result : null
  }

  function compactify(obj: Nullable<JsonObj>): Nullable<JsonObj> {
    if (!obj) return null
    const result = Object.fromEntries(
      Object.entries(obj).filter(([, value]) => value === null || (typeof value !== 'object' && !Array.isArray(value)))
    )
    return Object.keys(result).length > 0 ? result : null
  }

  function hasNestedData(obj: Nullable<JsonObj>): boolean {
    if (!obj) return false
    return Object.values(obj).some((value) => value !== null && typeof value === 'object')
  }

  function previewTooltip(obj: Nullable<JsonObj>): Nullable<string> {
    if (!obj) return null
    const previewKeys = Object.keys(obj).filter((key) => key.endsWith('_preview'))
    if (previewKeys.length === 0) return null
    const parts = previewKeys.map((key) => {
      const arr = obj[key]
      const count = Array.isArray(arr) ? String(arr.length) : '0'
      return `${key}: первые ${count} эл.`
    })
    return `Сокращённый preview. ${parts.join(', ')}. Полные данные не хранятся в логе.`
  }

  function display(obj: Nullable<JsonObj>, tab: TabMode): Nullable<JsonObj> {
    return tab === 'compact' ? compactify(obj) : obj
  }

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
  <div class="expanded-row-content q-pa-md border-lg">
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
