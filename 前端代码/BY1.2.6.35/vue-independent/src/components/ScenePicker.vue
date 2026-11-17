<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElButton, ElDialog, ElInput, ElMessage, ElPagination, ElSkeleton, ElTable, ElTableColumn } from 'element-plus'
import { api } from '../api'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'select'])
const name = ref('')
const page = ref(1)
const size = ref(5)
const total = ref(0)
const rows = ref([])
const loading = ref(false)
let operation

async function fetchRows() {
  operation?.abort()
  const current = operation = new AbortController()
  loading.value = true
  try {
    const result = await api.scenes(name.value, page.value, size.value, current.signal)
    if (operation !== current) return
    rows.value = result.rows
    total.value = result.total
  } catch (error) {
    if (error.name !== 'AbortError') {
      rows.value = []
      total.value = 0
      ElMessage.error('画面列表加载失败')
    }
  } finally {
    if (operation === current) loading.value = false
  }
}

function search() {
  page.value = 1
  fetchRows()
}

function choose(row) {
  emit('select', row)
  emit('update:modelValue', false)
}

watch(() => props.modelValue, open => open ? search() : operation?.abort(), { immediate: true })
onBeforeUnmount(() => operation?.abort())
</script>

<template>
  <ElDialog :model-value="modelValue" title="选择画面" width="min(660px, 95vw)" append-to-body @update:model-value="emit('update:modelValue', $event)">
    <form class="inline-form" @submit.prevent="search">
      <ElInput v-model="name" placeholder="画面名称" clearable />
      <ElButton type="primary" native-type="submit">查询</ElButton>
    </form>
    <ElSkeleton v-if="loading" animated :rows="4" />
    <ElTable v-else :data="rows" empty-text="暂无画面" max-height="390" row-key="stageId">
      <ElTableColumn prop="stageName" label="画面名称" min-width="150" />
      <ElTableColumn prop="stageId" label="画面 ID" min-width="140" show-overflow-tooltip />
      <ElTableColumn label="缩略图" width="90">
        <template #default="{ row }"><img v-if="row.stageBase64" :src="row.stageBase64" class="thumbnail" alt=""></template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="75">
        <template #default="{ row }"><ElButton type="primary" link @click="choose(row)">选择</ElButton></template>
      </ElTableColumn>
    </ElTable>
    <template #footer>
      <ElPagination v-model:current-page="page" v-model:page-size="size" :page-sizes="[5,10,30,60]" :total="total"
        layout="prev, pager, next, sizes" @current-change="fetchRows" @size-change="search" />
    </template>
  </ElDialog>
</template>

<style scoped>
.inline-form { display: flex; gap: 8px; margin-bottom: 12px; }
.thumbnail { width: 64px; height: 40px; object-fit: contain; }
</style>
