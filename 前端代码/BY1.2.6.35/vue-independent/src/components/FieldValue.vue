<script setup>
import { computed, ref, watch } from 'vue'
import {
  ElButton, ElColorPicker, ElInput, ElInputNumber, ElMessage, ElOption, ElSelect, ElSlider, ElSwitch,
} from 'element-plus'
import { literal } from '../scene/schema'

const props = defineProps({
  modelValue: { default: '' },
  type: { type: String, default: 'input' },
  options: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])
const json = computed(() => props.type === 'json')
const draft = ref('')
watch(() => props.modelValue, value => {
  draft.value = json.value ? typeof value === 'string' ? value : JSON.stringify(value, null, 2) : String(value ?? '')
}, { immediate: true, deep: true })
const numeric = computed(() => typeof props.modelValue === 'number')

function update(value) {
  emit('update:modelValue', value)
}

function saveJSON() {
  const parsed = literal(draft.value, undefined)
  if (parsed == null && draft.value.trim() !== 'null') return ElMessage.warning('请输入有效的 JSON 数据')
  update(typeof props.modelValue === 'string' ? JSON.stringify(parsed) : parsed)
}
</script>

<template>
  <ElColorPicker v-if="/^color/i.test(type)" :model-value="modelValue || ''" :show-alpha="type === 'colorAlpha'" @change="update" />
  <ElSlider v-else-if="type === 'slider'" :model-value="Number(modelValue ?? 1)" :max="1" :step="0.01" @change="update" />
  <ElSwitch v-else-if="typeof modelValue === 'boolean'" :model-value="modelValue" @change="update" />
  <ElSelect v-else-if="options.length" :model-value="modelValue" filterable allow-create default-first-option @change="update">
    <ElOption v-for="item in options" :key="item.value" :value="item.value" :label="item.name || item.label || String(item.value)" />
  </ElSelect>
  <div v-else-if="json" class="json-input">
    <ElInput v-model="draft" type="textarea" :rows="5" spellcheck="false" aria-label="配置 JSON" />
    <ElButton size="small" @click="saveJSON">应用</ElButton>
  </div>
  <ElInputNumber v-else-if="numeric" :model-value="modelValue" :controls="false" @change="update" />
  <ElInput v-else v-model="draft" :type="type === 'textarea' ? 'textarea' : 'text'" @change="update" />
</template>

<style scoped>
.json-input { width: 100%; display: grid; justify-items: end; gap: var(--ui-space-2); }
</style>
