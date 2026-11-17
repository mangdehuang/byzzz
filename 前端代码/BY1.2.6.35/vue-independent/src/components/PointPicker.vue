<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElButton, ElDialog, ElEmpty, ElForm, ElFormItem, ElMessage, ElOption, ElSelect, ElTabPane, ElTabs } from 'element-plus'
import { api } from '../api'

const props = defineProps({
  modelValue: Boolean,
  binding: { type: String, default: '' },
  variables: { type: Array, default: () => [] },
  onlyPhysical: Boolean,
})
const emit = defineEmits(['update:modelValue', 'select'])
const levels = [
  { label: '项目', key: 'project' },
  { label: '设备', key: 'device' },
  { label: '数据点', key: 'point' },
]
const lists = ref([[], [], []])
const values = ref(['', '', ''])
const tab = ref('device')
const virtual = ref('')
const loading = ref(-1)
let operation

async function query(kind, parent, signal) {
  const rows = await api.catalog(kind, parent, signal)
  return rows.map(row => ({ ...row, code: String(row.code) }))
}

async function reset() {
  operation?.abort()
  const current = operation = new AbortController()
  lists.value = [[], [], []]
  values.value = ['', '', '']
  virtual.value = props.variables.find(item => item.id === props.binding)?.id || ''
  tab.value = virtual.value && !props.onlyPhysical ? 'virtual' : 'device'
  loading.value = 0
  try {
    const projects = await query('project', '', current.signal)
    if (operation !== current) return
    lists.value[0] = projects
    if (!props.binding || virtual.value) return
    for (const project of projects) {
      const devices = await query('device', project.code, current.signal)
      for (const device of devices) {
        const prefix = device.code + '_'
        if (!props.binding.startsWith(prefix)) continue
        const points = await query('point', device.code, current.signal)
        if (operation !== current) return
        const point = points.find(item => prefix + item.code === props.binding)
        if (point) {
          lists.value = [projects, devices, points]
          values.value = [project.code, device.code, point.code]
          return
        }
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') ElMessage.error('设备目录加载失败')
  } finally {
    if (current === operation) loading.value = -1
  }
}

// 上级变化清理下级选择，并取消旧请求。
async function change(index, value) {
  for (let i = index + 1; i < levels.length; i += 1) {
    lists.value[i] = []
    values.value[i] = ''
  }
  if (index === 2) return
  operation?.abort()
  const current = operation = new AbortController()
  loading.value = value ? index + 1 : -1
  if (!value) return
  try {
    const rows = await query(levels[index + 1].key, value, current.signal)
    if (operation === current) lists.value[index + 1] = rows
  } catch (error) {
    if (error.name !== 'AbortError') ElMessage.error('设备目录加载失败')
  } finally {
    if (operation === current) loading.value = -1
  }
}

function select() {
  if (tab.value === 'virtual') {
    const item = props.variables.find(candidate => candidate.id === virtual.value)
    if (!item) return ElMessage.warning('请选择虚拟变量')
    emit('select', { key: item.id, name: item.name })
  } else {
    const item = lists.value[2].find(candidate => candidate.code === values.value[2])
    if (!item) return ElMessage.warning('请选择数据点')
    emit('select', { key: values.value[1] + '_' + item.code, name: item.name })
  }
  emit('update:modelValue', false)
}

watch(() => props.modelValue, open => open ? reset() : operation?.abort(), { immediate: true })
onBeforeUnmount(() => operation?.abort())
</script>

<template>
  <ElDialog :model-value="modelValue" title="选择数据点" width="min(500px, 94vw)" append-to-body @update:model-value="emit('update:modelValue', $event)">
    <ElTabs v-model="tab">
      <ElTabPane name="device" label="设备数据点">
        <ElForm label-width="70px">
          <ElFormItem v-for="(item, index) in levels" :key="item.key" :label="item.label">
            <ElSelect
              :id="'point-' + item.key" v-model="values[index]" :loading="loading === index"
              :disabled="index > 0 && !values[index - 1]" filterable clearable
              :placeholder="'请选择' + item.label" @change="change(index, $event)"
            >
              <ElOption v-for="entry in lists[index]" :key="entry.code" :label="entry.name + ' (' + entry.code + ')'" :value="entry.code" />
            </ElSelect>
          </ElFormItem>
        </ElForm>
      </ElTabPane>
      <ElTabPane v-if="!onlyPhysical" name="virtual" label="虚拟变量">
        <ElSelect v-if="variables.length" v-model="virtual" placeholder="请选择虚拟变量" filterable>
          <ElOption v-for="entry in variables" :key="entry.id" :label="entry.name" :value="entry.id" />
        </ElSelect>
        <ElEmpty v-else description="当前画面没有虚拟变量" :image-size="52" />
      </ElTabPane>
    </ElTabs>
    <template #footer>
      <ElButton @click="emit('update:modelValue', false)">取消</ElButton>
      <ElButton type="primary" @click="select">确定</ElButton>
    </template>
  </ElDialog>
</template>
