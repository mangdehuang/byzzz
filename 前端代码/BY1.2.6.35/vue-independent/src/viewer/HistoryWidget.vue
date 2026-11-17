<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import { ElButton, ElDatePicker, ElEmpty, ElSkeleton, ElTable, ElTableColumn } from 'element-plus'
import { asRows } from '../scene/schema'
import { appendFields, httpURL } from './widget-data'

const ChartView = defineAsyncComponent(() => import('./ChartView.vue'))
const props = defineProps({ attrs: Object, sceneID: String })
const type = computed(() => props.attrs.moduleType)
const table = computed(() => type.value === 'HTML_IFRAME_Table')
const alarm = computed(() => type.value.includes('ALERT'))
const endpoint = computed(() => httpURL(props.attrs.interface_address))
const fields = computed(() => asRows(props.attrs.TableField).filter(item => item.key))
const range = ref([])
const rows = ref([])
const chart = ref(null)
const message = ref('')
const failed = ref(false)
const loading = ref(false)
let refresh
let request

async function query() {
  if (!endpoint.value) return
  request?.abort()
  const current = request = new AbortController()
  const body = new URLSearchParams()
  if (alarm.value) body.set('stageId', props.sceneID)
  else if (table.value) {
    appendFields(body, 'TableConfig', fields.value)
    if (range.value?.length) {
      body.set('startDate', range.value[0])
      body.set('endDate', range.value[1])
    }
  } else {
    appendFields(body, 'dataPintField', fields.value)
  }
  loading.value = !rows.value.length && !chart.value && !message.value
  failed.value = false
  try {
    const token = new URLSearchParams(location.search).get('token')
    const headers = token && new URL(endpoint.value).origin === location.origin
      ? { Authorization: 'Bearer ' + token } : {}
    const response = await fetch(endpoint.value, { method: 'POST', body, headers, signal: current.signal })
    if (!response.ok) throw new Error()
    const data = await response.json()
    if (request !== current) return
    if (table.value) rows.value = Array.isArray(data) ? data : Array.isArray(data.rows || data.data) ? data.rows || data.data : []
    else if (alarm.value) message.value = typeof data.data === 'string' ? data.data : ''
    else chart.value = data.series ? data : data.data?.series ? data.data : null
  } catch (error) {
    if (error.name !== 'AbortError' && request === current) failed.value = true
  } finally {
    if (request === current) loading.value = false
  }
}
watch(endpoint, value => {
  clearInterval(refresh)
  request?.abort()
  if (!value) return
  query()
  const seconds = Number(props.attrs.request_frequency)
  if (seconds > 0 && !table.value) refresh = setInterval(query, Math.max(1, seconds) * 1000)
}, { immediate: true })
onBeforeUnmount(() => { clearInterval(refresh); request?.abort() })
</script>

<template>
  <div class="history">
    <ElEmpty v-if="!endpoint" :image-size="30" description="尚未配置数据接口" />
    <ElSkeleton v-else-if="loading" :rows="2" animated />
    <ElEmpty v-else-if="failed" :image-size="30" description="数据加载失败"><ElButton size="small" @click="query">重试</ElButton></ElEmpty>
    <template v-else-if="table">
      <form class="history-form" @submit.prevent="query">
        <ElDatePicker v-model="range" type="datetimerange" size="small" value-format="YYYY-MM-DD HH:mm:ss" />
        <ElButton native-type="submit" size="small">查询</ElButton>
      </form>
      <ElTable :data="rows" size="small" empty-text="暂无数据" max-height="320">
        <ElTableColumn v-for="field in fields" :key="field.key" :prop="field.key" :label="field.name || field.key" min-width="90" />
      </ElTable>
    </template>
    <div v-else-if="alarm && message" class="alarm-message">{{ message }}</div>
    <ChartView v-else-if="chart" :attrs="attrs" :historical="chart" />
    <ElEmpty v-else :image-size="30" description="暂无数据" />
  </div>
</template>

<style scoped>
.history { width: 100%; height: 100%; overflow: auto; background: #fff; }
.history-form { display: flex; padding: 4px; gap: 5px; }
.alarm-message { padding: 7px; overflow-wrap: anywhere; color: #a54610; }
</style>
