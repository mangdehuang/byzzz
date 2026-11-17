<script setup>
import { computed, ref } from 'vue'
import { ElButton, ElCollapse, ElCollapseItem, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch } from 'element-plus'
import PointPicker from '../components/PointPicker.vue'
import RecordTable from '../components/RecordTable.vue'
import ScenePicker from '../components/ScenePicker.vue'
import { asRows } from '../scene/schema'

const props = defineProps({ modelValue: { default: () => [] }, engine: Object })
const emit = defineEmits(['update:modelValue'])
const entries = computed(() => asRows(props.modelValue))
const nodes = computed(() => (props.engine?.groups() || []).map((node, index) => ({
  id: node.id(), label: node.getAttr('moduleName') || node.getAttr('moduleType') + ' ' + (index + 1),
  type: node.getAttr('moduleType'),
})))
const open = ref([])
const pointPicker = ref(false)
const scenePicker = ref(false)
const binding = ref('')
let choosePoint
let chooseScene

const eventModes = [
  ['1','打开链接'], ['2','跳转画面'], ['3','操作变量'], ['4','显示和隐藏图元'], ['5','提交输入框'],
]
const operationModes = [['1','写固定值'],['2','输入值'],['3','点动']]
const pulses = [['1','置 0'],['2','置 1'],['3','按 1 松 0'],['4','按 0 松 1']]
const destinations = [['1','新页面'],['2','当前页面'],['3','弹窗']]
const defaults = {
  behaviourType: '1', behavior_link: '', behavior_link_param: [],
  behavior_picture: { targetName: '', targetCode: '' }, openMode: '1', windowSize: { width: 650, height: 430 },
  behavior_variate: { key: '', name: '' }, operateMode: '1', fixedValue: '', defaultValue: '',
  clickMode: '1', delayTime: 0, behavior_client_message: '', behavior_client_input_message: '',
  mShowHide: { show: [], hide: [] }, submitInput: [],
}

function set(index, values) {
  emit('update:modelValue', entries.value.map((entry, position) => index === position ? { ...entry, ...values } : entry))
}
function behavior(index, values) {
  set(index, { eventBehaviour: { ...entries.value[index].eventBehaviour, ...values } })
}
function add() {
  const index = entries.value.length
  emit('update:modelValue', [...entries.value, { eventType: '1', isOpenEvent: '1', eventBehaviour: { ...defaults } }])
  open.value = [...open.value, String(index)]
}
function usePoint(current, assign) {
  binding.value = current || ''
  choosePoint = assign
  pointPicker.value = true
}
function useScene(index) {
  chooseScene = row => behavior(index, { behavior_picture: { targetName: row.stageName, targetCode: row.stageId } })
  scenePicker.value = true
}
function selectedIDs(data) {
  return asRows(data).map(item => item.id)
}
function resolveNodes(ids) {
  return ids.map(id => ({ id, name: nodes.value.find(item => item.id === id)?.label || id }))
}
</script>

<template>
  <ElCollapse v-model="open">
    <ElCollapseItem v-for="(entry, index) in entries" :key="index" :name="String(index)" :title="'事件 ' + (index + 1)">
      <ElForm label-width="105px" size="small" @submit.prevent>
        <ElFormItem label="启用">
          <ElSwitch :model-value="String(entry.isOpenEvent) === '1'" @change="set(index, { isOpenEvent: $event ? '1' : '0' })" />
        </ElFormItem>
        <ElFormItem label="触发方式">
          <ElSelect :model-value="String(entry.eventType || '1')" @change="set(index, { eventType: $event })">
            <ElOption value="1" label="单击" /><ElOption value="2" label="双击" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="事件行为">
          <ElSelect :model-value="String(entry.eventBehaviour?.behaviourType || '1')" @change="behavior(index, { behaviourType: $event })">
            <ElOption v-for="[value,label] in eventModes" :key="value" :value="value" :label="label" />
          </ElSelect>
        </ElFormItem>
        <template v-if="String(entry.eventBehaviour?.behaviourType || '1') === '1'">
          <ElFormItem label="链接地址">
            <ElInput :model-value="entry.eventBehaviour?.behavior_link" @change="behavior(index, { behavior_link: $event })" />
          </ElFormItem>
          <ElFormItem label="链接参数">
            <RecordTable :rows="asRows(entry.eventBehaviour?.behavior_link_param)" :row-template="{ key: '', name: '' }"
              @update:rows="behavior(index, { behavior_link_param: $event })"
              @bind="row => usePoint(entry.eventBehaviour?.behavior_link_param?.[row]?.key, point => {
                behavior(index, { behavior_link_param: asRows(entry.eventBehaviour?.behavior_link_param)
                  .map((item, position) => row === position ? { ...item, ...point } : item) })
              })" />
          </ElFormItem>
        </template>
        <ElFormItem v-else-if="String(entry.eventBehaviour?.behaviourType) === '2'" label="目标画面">
          <ElButton @click="useScene(index)">{{ entry.eventBehaviour?.behavior_picture?.targetName || '选择画面' }}</ElButton>
        </ElFormItem>
        <template v-if="['1','2'].includes(String(entry.eventBehaviour?.behaviourType || '1'))">
          <ElFormItem label="打开方式">
            <ElSelect :model-value="String(entry.eventBehaviour?.openMode || '1')" @change="behavior(index, { openMode: $event })">
              <ElOption v-for="[value,label] in destinations" :key="value" :value="value" :label="label" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem v-if="String(entry.eventBehaviour?.openMode) === '3'" label="弹窗尺寸">
            <ElInputNumber :model-value="Number(entry.eventBehaviour?.windowSize?.width || 650)" :min="240"
              @change="behavior(index, { windowSize: { ...entry.eventBehaviour?.windowSize, width: $event } })" />
            <ElInputNumber :model-value="Number(entry.eventBehaviour?.windowSize?.height || 430)" :min="120"
              @change="behavior(index, { windowSize: { ...entry.eventBehaviour?.windowSize, height: $event } })" />
          </ElFormItem>
        </template>
        <template v-else-if="String(entry.eventBehaviour?.behaviourType) === '3'">
          <ElFormItem label="操作变量">
            <ElButton @click="usePoint(entry.eventBehaviour?.behavior_variate?.key, point => behavior(index, { behavior_variate: point }))">
              {{ entry.eventBehaviour?.behavior_variate?.name || '选择数据点' }}
            </ElButton>
          </ElFormItem>
          <ElFormItem label="操作方式">
            <ElSelect :model-value="String(entry.eventBehaviour?.operateMode || '1')" @change="behavior(index, { operateMode: $event })">
              <ElOption v-for="[value,label] in operationModes" :key="value" :value="value" :label="label" />
            </ElSelect>
          </ElFormItem>
          <template v-if="String(entry.eventBehaviour?.operateMode) === '3'">
            <ElFormItem label="点动行为">
              <ElSelect :model-value="String(entry.eventBehaviour?.clickMode || '1')" @change="behavior(index, { clickMode: $event })">
                <ElOption v-for="[value,label] in pulses" :key="value" :value="value" :label="label" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem v-if="['3','4'].includes(String(entry.eventBehaviour?.clickMode))" label="延时（秒）">
              <ElInputNumber :model-value="Number(entry.eventBehaviour?.delayTime || 0)" :min="0" :step="0.1"
                @change="behavior(index, { delayTime: $event })" />
            </ElFormItem>
          </template>
          <ElFormItem v-else-if="String(entry.eventBehaviour?.operateMode) === '2'" label="默认值">
            <ElInput :model-value="String(entry.eventBehaviour?.defaultValue ?? '')" @change="behavior(index, { defaultValue: $event })" />
          </ElFormItem>
          <ElFormItem v-else label="固定值">
            <ElInput :model-value="String(entry.eventBehaviour?.fixedValue ?? '')" @change="behavior(index, { fixedValue: $event })" />
          </ElFormItem>
          <ElFormItem label="确认提示">
            <ElInput :model-value="entry.eventBehaviour?.behavior_client_message" @change="behavior(index, { behavior_client_message: $event })" />
          </ElFormItem>
        </template>
        <template v-else-if="String(entry.eventBehaviour?.behaviourType) === '4'">
          <ElFormItem v-for="[key,label] in [['show','显示图元'],['hide','隐藏图元']]" :key="key" :label="label">
            <ElSelect :model-value="selectedIDs(entry.eventBehaviour?.mShowHide?.[key])" multiple filterable
              @change="behavior(index, { mShowHide: { ...entry.eventBehaviour?.mShowHide, [key]: resolveNodes($event) } })">
              <ElOption v-for="item in nodes" :key="item.id" :label="item.label" :value="item.id" />
            </ElSelect>
          </ElFormItem>
        </template>
        <template v-else-if="String(entry.eventBehaviour?.behaviourType) === '5'">
          <ElFormItem label="输入框">
            <ElSelect :model-value="selectedIDs(entry.eventBehaviour?.submitInput)" multiple filterable
              @change="behavior(index, { submitInput: resolveNodes($event) })">
              <ElOption v-for="item in nodes.filter(item => item.type === 'INPUT_FORM')" :key="item.id" :label="item.label" :value="item.id" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="确认提示">
            <ElInput :model-value="entry.eventBehaviour?.behavior_client_input_message" @change="behavior(index, { behavior_client_input_message: $event })" />
          </ElFormItem>
        </template>
        <ElFormItem><ElButton type="danger" link @click="emit('update:modelValue', entries.filter((_, position) => position !== index))">删除事件</ElButton></ElFormItem>
      </ElForm>
    </ElCollapseItem>
  </ElCollapse>
  <ElButton class="new-event" size="small" @click="add">添加事件</ElButton>
  <PointPicker v-model="pointPicker" :binding="binding" :variables="engine?.stage.attrs.dummyVarList || []" @select="choosePoint($event)" />
  <ScenePicker v-model="scenePicker" @select="chooseScene($event)" />
</template>

<style scoped>.new-event { margin-top: 10px; }</style>
