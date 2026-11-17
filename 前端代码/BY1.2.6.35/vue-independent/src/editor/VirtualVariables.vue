<script setup>
import { ref } from 'vue'
import { ElButton, ElCollapse, ElCollapseItem, ElForm, ElFormItem, ElInput } from 'element-plus'
import PointPicker from '../components/PointPicker.vue'
import RecordTable from '../components/RecordTable.vue'
import { asRows, uid } from '../scene/schema'

const props = defineProps({ modelValue: { type: Array, required: true } })
const emit = defineEmits(['update:modelValue'])
const selected = ref([])
const picker = ref(false)
const binding = ref('')
let applyBinding
const blankPoint = { hardware_code: '', hardware_name: '', hardware_cmd: '' }

function replace(index, value) {
  emit('update:modelValue', props.modelValue.map((item, position) => index === position ? { ...item, ...value } : item))
}
function add() {
  const item = { id: 'DVAR' + uid(), name: '', script: '', pointDatas: [] }
  emit('update:modelValue', [...props.modelValue, item])
  selected.value = [...selected.value, item.id]
}
function bind(index, row) {
  const targets = asRows(props.modelValue[index].pointDatas)
  binding.value = targets[row]?.hardware_code || ''
  applyBinding = point => replace(index, { pointDatas: targets.map((item, position) => row === position
    ? { ...item, hardware_code: point.key, hardware_name: point.name } : item) })
  picker.value = true
}
</script>

<template>
  <ElCollapse v-model="selected">
    <ElCollapseItem v-for="(entry, index) in modelValue" :key="entry.id" :name="entry.id" :title="entry.name || '新变量'">
      <ElForm label-position="top" size="small" @submit.prevent>
        <ElFormItem label="变量名称"><ElInput :model-value="entry.name" @change="replace(index, { name: $event })" /></ElFormItem>
        <ElFormItem label="变量编号"><ElInput :model-value="entry.id" readonly /></ElFormItem>
        <ElFormItem label="计算公式">
          <ElInput :model-value="entry.script" type="textarea" :rows="3" placeholder="return {{点位编号}} * 2"
            @change="replace(index, { script: $event })" />
        </ElFormItem>
        <ElFormItem label="反控数据点">
          <RecordTable :rows="asRows(entry.pointDatas)" :row-template="blankPoint"
            @update:rows="replace(index, { pointDatas: $event })" @bind="bind(index, $event)" />
        </ElFormItem>
        <ElButton type="danger" link @click="emit('update:modelValue', modelValue.filter((_, position) => index !== position))">删除变量</ElButton>
      </ElForm>
    </ElCollapseItem>
  </ElCollapse>
  <ElButton class="new-variable" size="small" @click="add">新增虚拟变量</ElButton>
  <PointPicker v-model="picker" :binding="binding" only-physical @select="applyBinding($event)" />
</template>

<style scoped>.new-variable { margin-top: 10px; }</style>
