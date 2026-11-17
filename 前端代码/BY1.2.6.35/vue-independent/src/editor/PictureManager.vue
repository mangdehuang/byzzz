<script setup>
import { ref, watch } from 'vue'
import { ElButton, ElDialog, ElEmpty, ElMessage, ElMessageBox, ElSkeleton, ElUpload } from 'element-plus'
import { api } from '../api'
import { assetURL } from '../scene/schema'

const props = defineProps({ group: Object })
const emit = defineEmits(['close', 'changed'])
const items = ref([])
const loading = ref(false)
const busy = ref(false)

async function refresh() {
  if (!props.group) return
  const id = props.group.groupId
  loading.value = true
  try {
    const result = await api.pictures(id)
    if (props.group?.groupId === id) items.value = result
  } catch {
    ElMessage.error('图片列表加载失败')
  } finally {
    loading.value = false
  }
}

async function upload({ file, onSuccess, onError }) {
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 10 MiB')
    return onError(new Error('图片过大'))
  }
  const id = props.group.groupId
  busy.value = true
  try {
    if (await api.upload(id, file) !== 1) throw new Error()
    onSuccess()
    await refresh()
    emit('changed', [id])
    ElMessage.success('上传成功')
  } catch (error) {
    onError(error)
    ElMessage.error('图片上传失败')
  } finally {
    busy.value = false
  }
}

async function remove(item) {
  try {
    await ElMessageBox.confirm('从图库移除此图片？', '删除图片')
    if (await api.deletePicture(item.id) !== 1) throw new Error()
    await refresh()
    emit('changed', [props.group.groupId])
  } catch (error) {
    if (!['close', 'cancel'].includes(error)) ElMessage.error('图片删除失败')
  }
}
watch(() => props.group, refresh)
</script>

<template>
  <ElDialog :model-value="!!group" :title="group?.groupName || '图库图片'" width="min(680px, 95vw)" append-to-body
    @update:model-value="!$event && emit('close')">
    <ElUpload :http-request="upload" :show-file-list="false" :disabled="busy" accept="image/jpeg,image/png,image/gif,image/svg+xml">
      <ElButton type="primary" :loading="busy">上传图片</ElButton>
    </ElUpload>
    <ElSkeleton v-if="loading" animated :rows="4" />
    <ElEmpty v-else-if="!items.length" description="暂无图片" :image-size="54" />
    <div v-else class="images">
      <div v-for="item in items" :key="item.id">
        <img :src="assetURL(item.picUrl)" alt="图库图片">
        <ElButton type="danger" link @click="remove(item)">删除</ElButton>
      </div>
    </div>
  </ElDialog>
</template>

<style scoped>
.images { display: grid; grid-template-columns: repeat(auto-fill,minmax(100px,1fr)); gap: 10px; margin-top: 12px; max-height: 460px; overflow: auto; }
.images > div { display: grid; justify-items: center; border: 1px solid var(--ui-border); border-radius: var(--ui-radius); padding: 5px; }
.images img { width: 90px; height: 72px; object-fit: contain; }
</style>
