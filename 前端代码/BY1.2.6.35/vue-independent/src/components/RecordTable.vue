<script setup>
import { computed } from 'vue'
import { ElButton, ElEmpty, ElTable, ElTableColumn } from 'element-plus'
import FieldValue from './FieldValue.vue'

const props = defineProps({
  rows: { type: Array, required: true },
  columns: { type: Array, default: () => [] },
  rowTemplate: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:rows', 'bind'])
const labels = {
  key: '数据点', devicecode: '数据点', name: '名称', devicename: '名称', min: '下限',
  max: '上限', value: '值', color: '颜色', url: '地址', urlContent: '弹窗地址',
  contentWidth: '宽', contentHeight: '高', time: '秒数', descript: '说明', unit: '单位',
  description: '描述', status: '状态', command: '点击命令', icon: '图片地址', cmd: '命令',
  direction: '流动方向', directionRotation: '旋转方向', zoomSize: '缩放倍数', decimalDigits: '小数位数',
  fill: '填充颜色', textState: '开合状态', hardware_code: '反控数据点', hardware_name: '名称', hardware_cmd: '反控命令',
}
const keys = computed(() => props.columns.length ? props.columns : [...new Set([...Object.keys(props.rowTemplate), ...props.rows.flatMap(Object.keys)])])
const bindable = key => ['key', 'devicecode', 'hardware_code'].includes(key)

function write(index, key, value) {
  const rows = props.rows.map((row, position) => index === position ? { ...row, [key]: value } : row)
  emit('update:rows', rows)
}
</script>

<template>
  <ElTable v-if="keys.length" :data="rows" size="small" max-height="410" empty-text="暂无规则">
    <ElTableColumn v-for="key in keys" :key="key" :label="labels[key] || key" min-width="116">
      <template #default="{ row, $index }">
        <ElButton v-if="bindable(key)" link type="primary" @click="emit('bind', $index, key)">
          {{ row[key] || '绑定' }}
        </ElButton>
        <FieldValue v-else :model-value="row[key]" :type="key.toLowerCase().includes('color') || key === 'fill' ? 'colorAlpha' : typeof row[key] === 'object' && row[key] !== null ? 'json' : 'input'"
          @update:model-value="write($index, key, $event)" />
      </template>
    </ElTableColumn>
    <ElTableColumn label="操作" width="62">
      <template #default="{ $index }"><ElButton type="danger" link @click="emit('update:rows', rows.filter((_, index) => index !== $index))">删除</ElButton></template>
    </ElTableColumn>
  </ElTable>
  <ElEmpty v-else :image-size="48" description="暂无可编辑字段" />
  <ElButton size="small" class="add-row" @click="emit('update:rows', [...rows, { ...rowTemplate }])">添加行</ElButton>
</template>

<style scoped>
.add-row { margin-top: 8px; }
</style>
