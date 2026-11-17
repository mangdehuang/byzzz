<script setup>
import { onMounted, ref } from 'vue'
import {
  ElButton, ElCollapse, ElCollapseItem, ElEmpty, ElMessage, ElMessageBox, ElScrollbar, ElSkeleton, ElTabPane, ElTabs,
} from 'element-plus'
import { api, resource } from '../api'
import { assetURL } from '../scene/schema'

const emit = defineEmits(['apply', 'template', 'insert', 'pictures'])
const selected = ref('base')
const loading = ref(true)
const packs = ref({ base: [], images: [], decor: [], presets: [] })
const groups = ref([])
const templates = ref([])
const pictures = ref({})
const open = ref({ base: [], images: [], decor: [], presets: [], library: [] })
const tabs = [
  ['base', '基础组件', 'jczj.png'], ['images', '图元图库', 'tytk.png'], ['decor', '画面装饰', 'hmzs.png'],
  ['presets', '画面模板', 'hmmb.png'], ['library', '我的图库', 'wdtk.png'],
]

async function boot() {
  try {
    const keys = { base: 'module_config_base', images: 'module_config', decor: 'module_config_decoration', presets: 'module_stage' }
    const entries = await Promise.all(Object.entries(keys).map(async ([tab, file]) => [tab, await resource(file)]))
    packs.value = Object.fromEntries(entries)
    open.value.base = [packs.value.base[0]?.groupName]
  } catch {
    ElMessage.error('内置图元清单加载失败')
  } finally {
    loading.value = false
  }
}

async function refresh(name) {
  try {
    if (name === 'library') groups.value = await api.groups()
    if (name === 'presets') templates.value = await api.templates()
  } catch {
    ElMessage.error(name === 'library' ? '图库分组加载失败' : '模板加载失败')
  }
}

async function refreshPictures(ids) {
  try {
    await Promise.all(ids.map(async id => { pictures.value[id] = await api.pictures(id) }))
  } catch {
    ElMessage.error('图库图片加载失败')
  }
}

async function groupAction(group) {
  try {
    const { value } = await ElMessageBox.prompt('分组名称', group ? '修改分组' : '新增分组', {
      inputValue: group?.groupName || '', inputValidator: value => !!value?.trim() || '请输入分组名称',
    })
    if (await api.saveGroup(value, group?.groupId) !== 1) throw new Error()
    await refresh('library')
  } catch (error) {
    if (!['close', 'cancel'].includes(error)) ElMessage.error('分组保存失败')
  }
}

async function removeGroup(group) {
  try {
    await ElMessageBox.confirm('删除分组「' + group.groupName + '」？', '删除分组')
    const result = await api.deleteGroup(group.groupId)
    if (result === -1) return ElMessage.warning('分组下有图片，不能删除')
    if (result !== 1) throw new Error()
    await refresh('library')
  } catch (error) {
    if (!['close', 'cancel'].includes(error)) ElMessage.error('分组删除失败')
  }
}

async function removeTemplate(template) {
  try {
    await ElMessageBox.confirm('删除模板「' + template.templateName + '」？', '删除模板')
    if (await api.deleteTemplate(template.templateId) !== 1) throw new Error()
    await refresh('presets')
  } catch (error) {
    if (!['close', 'cancel'].includes(error)) ElMessage.error('模板删除失败')
  }
}

function pictureModel(item) {
  return {
    className: 'Group',
    attrs: { name: 'jyzt_module_group', moduleType: /\.gif$/i.test(item.picUrl) ? 'GIF' : 'IMAGES', imageURL: item.picUrl,
      moduleAttr: [{ attrName: '图片', attrCode: 'imageURL', attrWhere: 'this', attrType: 'Image' }] },
    children: [{ className: 'Image', attrs: {} }],
  }
}

function startDrag(event, model) {
  event.dataTransfer.setData('application/x-byzt-node', JSON.stringify(model))
  event.dataTransfer.effectAllowed = 'copy'
}

defineExpose({ refresh, refreshPictures })
onMounted(boot)
</script>

<template>
  <aside class="asset-palette">
    <ElTabs v-model="selected" tab-position="left" class="asset-tabs" @tab-change="refresh">
      <ElTabPane v-for="[id, title, icon] in tabs" :key="id" :name="id" lazy>
        <template #label><span class="asset-tab"><img :src="'/byzt/config/icon/' + icon" alt="">{{ title }}</span></template>
        <ElScrollbar>
          <ElSkeleton v-if="loading && id !== 'library'" animated :rows="5" />
          <ElCollapse v-else-if="['base', 'images', 'decor'].includes(id)" v-model="open[id]">
            <ElCollapseItem v-for="group in packs[id]" :key="group.groupName" :title="group.groupName" :name="group.groupName">
              <div class="asset-grid">
                <button v-for="(item, index) in group.moduleItem" :key="index" type="button" class="asset-tile"
                  draggable="true" :title="item.moduleName" :aria-label="item.moduleName" @dragstart="startDrag($event, item.moduleJson)" @dblclick="emit('insert', item.moduleJson)">
                  <img :src="assetURL(item.iconBase64)" alt="" draggable="false">
                  <span>{{ item.moduleName }}</span>
                </button>
              </div>
            </ElCollapseItem>
          </ElCollapse>
          <div v-else-if="id === 'presets'" class="asset-padded">
            <ElCollapse v-model="open.presets">
              <ElCollapseItem v-for="group in packs.presets" :key="group.groupName" :title="group.groupName" :name="group.groupName">
                <div v-for="item in group.moduleStageItem" :key="item.moduleName" class="template-row">
                  <img :src="assetURL(item.iconBase64)" alt="">
                  <span>{{ item.moduleName }}</span>
                  <ElButton size="small" link @click="emit('apply', item.moduleStageJson)">应用</ElButton>
                </div>
              </ElCollapseItem>
              <ElCollapseItem name="mine" title="我的模板">
                <ElEmpty v-if="!templates.length" description="暂无模板" :image-size="45" />
                <div v-for="item in templates" :key="item.templateId" class="template-row">
                  <img v-if="item.stageBase64" :src="assetURL(item.stageBase64)" alt="">
                  <span>{{ item.templateName }}</span>
                  <ElButton size="small" link @click="emit('template', item)">应用</ElButton>
                  <ElButton type="danger" size="small" link @click="removeTemplate(item)">删除</ElButton>
                </div>
              </ElCollapseItem>
            </ElCollapse>
          </div>
          <div v-else class="asset-padded">
            <ElButton id="add_group" type="primary" plain size="small" @click="groupAction()">新增分组</ElButton>
            <ElEmpty v-if="!groups.length" description="暂无图库分组" :image-size="48" />
            <ElCollapse v-else v-model="open.library" @change="refreshPictures">
              <ElCollapseItem v-for="group in groups" :key="group.groupId" :name="group.groupId" :title="group.groupName">
                <div class="asset-group-actions">
                  <ElButton size="small" @click="emit('pictures', group)">管理图片</ElButton>
                  <ElButton size="small" link @click="groupAction(group)">改名</ElButton>
                  <ElButton size="small" link type="danger" @click="removeGroup(group)">删除</ElButton>
                </div>
                <div class="asset-grid">
                  <button v-for="item in pictures[group.groupId] || []" :key="item.id" type="button" class="asset-tile"
                    draggable="true" @dragstart="startDrag($event, pictureModel(item))" @dblclick="emit('insert', pictureModel(item))">
                    <img :src="assetURL(item.picUrl)" alt="图库图片" draggable="false">
                  </button>
                </div>
              </ElCollapseItem>
            </ElCollapse>
          </div>
        </ElScrollbar>
      </ElTabPane>
    </ElTabs>
  </aside>
</template>

<style scoped lang="less">
.asset-palette { min-height: 0; overflow: hidden; border-right: 1px solid var(--ui-border); }
.asset-tabs { height: 100%; }
.asset-tabs :deep(.el-tabs__header) { margin-right: 0; background: var(--ui-surface-muted); }
.asset-tabs :deep(.el-tabs__item) { height: 64px; padding: 0 4px; }
.asset-tabs :deep(.el-tabs__item.is-active) { background: var(--el-color-primary-light-9); }
.asset-tabs :deep(.el-tabs__content), .asset-tabs :deep(.el-tab-pane) { height: 100%; min-width: 0; }
.asset-tabs :deep(.el-collapse-item__header) { padding: 0 var(--ui-space-2); font-size: var(--ui-font-body); line-height: var(--ui-line-body); }
.asset-tab { display: grid; justify-items: center; gap: 4px; font-size: 12px; }
.asset-tab img { width: 24px; height: 24px; object-fit: contain; }
.asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); gap: var(--ui-space-2); padding: 0 var(--ui-space-2); }
.asset-tile { display: grid; justify-items: center; align-content: start; gap: var(--ui-space-1); background: var(--ui-surface-muted); border: 1px solid var(--ui-border); cursor: grab; min-width: 0; padding: var(--ui-space-1); font-size: var(--ui-font-caption); line-height: var(--ui-line-caption); border-radius: var(--ui-radius); }
.asset-tile:hover { border-color: var(--ui-accent); background: var(--ui-surface-hover); }
// 缩略图保留中性衬底，以便辨认透明图片里的深色线条。
.asset-tile img { width: 40px; height: 40px; object-fit: contain; background: var(--ui-preview-matte); border-radius: var(--ui-radius); }
.asset-tile span { overflow-wrap: anywhere; text-align: center; }
.asset-padded { padding: 8px; }
.template-row { display: flex; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-2) 0; }
.template-row img { width: 40px; height: 28px; object-fit: contain; }
.template-row span { flex: 1; overflow-wrap: anywhere; }
.asset-group-actions { display: flex; gap: var(--ui-space-1); }
.asset-group-actions .el-button + .el-button, .template-row .el-button + .el-button { margin-left: 0; }
</style>
