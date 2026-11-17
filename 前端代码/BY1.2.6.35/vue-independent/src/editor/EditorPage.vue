<script setup>
import { openPreview } from '../viewer/draft.js'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import {
  ElButton, ElDialog, ElEmpty, ElMessage, ElMessageBox, ElScrollbar, ElSkeleton, ElTabPane, ElTabs, ElTree,
} from 'element-plus'
import { api, resource, sceneID } from '../api'
import { SceneStage } from '../scene/stage'
import { asRows, assetURL, literal, uid } from '../scene/schema'
import AssetPalette from './AssetPalette.vue'
import EditorTools from './EditorTools.vue'
import NodeProperties from './NodeProperties.vue'
import PictureManager from './PictureManager.vue'
import VirtualVariables from './VirtualVariables.vue'
import SceneSettings from './SceneSettings.vue'
import PointPicker from '../components/PointPicker.vue'
import RecordTable from '../components/RecordTable.vue'
import ScenePicker from '../components/ScenePicker.vue'
import WidgetOverlay from '../viewer/WidgetOverlay.vue'

const host = ref()
const palette = ref()
const engine = shallowRef()
const config = shallowRef()
const id = ref(sceneID())
const name = ref('')
const revision = ref(0)
const zoom = ref(1)
const active = ref('properties')
const saving = ref(false)
const initialized = ref(false)
const failed = ref(false)
const templateID = ref('')
const templateName = ref('')
const scenePicker = ref(false)
const conditionDialog = ref(false)
const variableDialog = ref(false)
const group = ref(null)
const pointPicker = ref(false)
const bindKey = ref('')
const imageDialog = ref(false)
const imageGroups = ref([])
const imageLoading = ref(false)
const imageFailed = ref(false)
const shortcuts = ref(false)
const showAssets = ref(true)
const showInspector = ref(true)
const menu = ref(null)
let onImage
let onPoint
let savedDocument = ''

const node = computed(() => {
  void revision.value
  return engine.value?.selected.length === 1 ? engine.value.selected[0] : null
})
const layers = computed(() => {
  void revision.value
  return (engine.value?.groups() || []).map((item, index) => ({
    id: item.id(), label: item.getAttr('moduleName') || item.getAttr('moduleType') + ' ' + (index + 1), item,
  }))
})
const dimensions = computed(() => {
  void revision.value
  return engine.value?.stage.size() || { width: 1024, height: 768 }
})
const conditions = computed(() => {
  void revision.value
  return asRows(engine.value?.stage.getAttr('conditionInfo').conditionWhere)
})
const variables = computed(() => {
  void revision.value
  return engine.value?.stage.getAttr('dummyVarList') || []
})
const conditionRow = { devicecode: '', devicename: '', min: '', max: '', urlContent: '', contentWidth: 500, contentHeight: 400, time: 0 }
const contextActions = [['lock','锁定'],['unlock','解除锁定'],['up','上移一层'],['down','下移一层'],['front','置于顶层'],['back','置于底层'],['delete','删除组件']]

async function start() {
  try {
    config.value = await resource('init')
    engine.value = new SceneStage(host.value, config.value, {
      editing: true,
      changed: () => { revision.value += 1 },
      activated: (item, event) => { menu.value = item ? { x: event.clientX, y: event.clientY } : null },
    })
    if (id.value) {
      const saved = await api.scene(id.value)
      name.value = saved.stageName
      engine.value.import(saved.stagedatajson)
    }
    engine.value.resetHistory()
    savedDocument = engine.value.serialize()
    initialized.value = true
  } catch {
    failed.value = true
    ElMessage.error('组态画面加载失败')
  }
}

function drop(event) {
  if (!initialized.value) return
  const value = event.dataTransfer.getData('application/x-byzt-node')
  if (!value) return
  const rectangle = host.value.getBoundingClientRect()
  try {
    insert(JSON.parse(value), {
      x: (event.clientX - rectangle.left) / zoom.value,
      y: (event.clientY - rectangle.top) / zoom.value,
    })
  } catch {
    ElMessage.error('无法添加图元')
  }
}

function insert(model, position = { x: 60, y: 60 }) {
  if (!initialized.value) return
  engine.value.insert(JSON.parse(JSON.stringify(model)), position)
  active.value = 'properties'
}

function updateID(value) {
  id.value = value
  const url = new URL(location.href)
  url.searchParams.delete('stageId')
  url.searchParams.set('id', value)
  history.replaceState(null, '', url)
}

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const data = engine.value.export()
    const result = await api.save({
      id: id.value || undefined, stageName: name.value || undefined,
      stagedatajson: data.json, datakeyarray: data.keys, stagebase64: data.thumbnail,
    })
    if (!id.value) {
      updateID(result.id)
      name.value = result.stageName
    } else if (result !== 1) {
      throw new Error('画面不存在')
    }
    savedDocument = engine.value.serialize()
    ElMessage.success('画面已保存')
  } catch {
    ElMessage.error('画面保存失败')
  } finally {
    saving.value = false
  }
}

async function saveTemplate() {
  try {
    const { value } = await ElMessageBox.prompt('模板名称', '保存到模板', {
      inputValue: templateName.value, inputValidator: value => Boolean(value?.trim()) || '请输入模板名称',
    })
    const data = engine.value.export()
    templateID.value = await api.saveTemplate({
      templateId: templateID.value, templateName: value, stageDatajson: data.json, stageBase64: data.thumbnail,
    })
    templateName.value = value
    await palette.value.refresh('presets')
    ElMessage.success('模板已保存')
  } catch (error) {
    if (!['close', 'cancel'].includes(error)) ElMessage.error('模板保存失败')
  }
}

function applyTemplate(value, template = null) {
  try {
    engine.value.import(value)
    templateID.value = template?.templateId || ''
    templateName.value = template?.templateName || ''
  } catch {
    ElMessage.error('模板读取失败')
  }
}

function preview() {
  const key = 'byzt:preview:' + uid()
  try {
    openPreview(engine.value.export().json, { key })
  } catch {
    ElMessage.error('预览画面创建失败，请允许浏览器打开弹出窗口后重试')
  }
}

function openScene(row) {
  const url = new URL(location.href)
  url.searchParams.delete('stageId')
  url.searchParams.set('id', row.stageId)
  location.assign(url.href)
}

function setConditions(next) {
  engine.value.stage.getAttr('conditionInfo').conditionWhere = next
  engine.value.commit()
}
function setVariables(next) {
  engine.value.stage.setAttr('dummyVarList', next.map(item => ({ ...item, id: item.id || 'DVAR' + uid() })))
  engine.value.commit()
}
function chooseConditionPoint(index, key) {
  bindKey.value = conditions.value[index]?.[key] || ''
  onPoint = point => setConditions(conditions.value.map((row, position) => index === position
    ? { ...row, [key]: point.key, devicename: point.name }
    : row))
  pointPicker.value = true
}

async function imagePicker(handler) {
  onImage = handler
  imageDialog.value = true
  imageLoading.value = true
  imageFailed.value = false
  try {
    const [builtIn, decor, groups] = await Promise.all([resource('module_config'), resource('module_config_decoration'), api.groups()])
    const library = await Promise.all(groups.map(async entry => ({
      groupName: entry.groupName,
      moduleItem: (await api.pictures(entry.groupId)).map(item => ({ moduleName: '图库图片', iconBase64: item.picUrl })),
    })))
    imageGroups.value = [...library, ...builtIn, ...decor]
  } catch {
    imageFailed.value = true
    ElMessage.error('图片清单加载失败')
  } finally {
    imageLoading.value = false
  }
}
function selectImage(item) {
  const url = literal(item.moduleJson)?.attrs.imageURL || item.iconBase64
  onImage(url)
  imageDialog.value = false
}

function adjustZoom(offset) {
  zoom.value = Math.min(5, Math.max(0.15, Math.round((zoom.value + offset) * 100) / 100))
}

function action(command) {
  menu.value = null
  if (!initialized.value) return
  const actions = {
    save, template: saveTemplate, preview,
    open: () => { scenePicker.value = true },
    fullscreen: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => ElMessage.warning('浏览器无法进入全屏')),
    variables: () => { variableDialog.value = true },
    'zoom-in': () => adjustZoom(0.1), 'zoom-out': () => adjustZoom(-0.1), 'zoom-reset': () => { zoom.value = 1 },
  }
  if (actions[command]) actions[command]()
  else engine.value.action(command)
}

function keydown(event) {
  if (!initialized.value || event.target.closest('input,textarea,[contenteditable=true],.el-dialog')) return
  const command = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()
  const keys = { a: 'all', v: 'copy', z: event.shiftKey ? 'redo' : 'undo', y: 'redo', s: 'save', p: 'preview' }
  if (command && keys[key]) {
    event.preventDefault()
    action(keys[key])
  } else if (key === 'delete') action('delete')
  else if (key === 'escape') engine.value.select([])
  else if (['arrowleft','arrowright','arrowup','arrowdown'].includes(key) && engine.value.selected.length) {
    event.preventDefault()
    const step = command ? 10 : 1
    const x = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0
    const y = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0
    engine.value.selected.forEach(item => item.move({ x, y }))
    engine.value.commit()
  }
}

function guard(event) {
  if (initialized.value && engine.value.serialize() !== savedDocument) {
    event.preventDefault()
    event.returnValue = ''
  }
}

onMounted(() => {
  start()
  window.addEventListener('keydown', keydown)
  window.addEventListener('beforeunload', guard)
})
onBeforeUnmount(() => {
  engine.value?.destroy()
  window.removeEventListener('keydown', keydown)
  window.removeEventListener('beforeunload', guard)
})
</script>

<template>
  <div class="editor" @click="menu = null">
    <EditorTools :zoom="zoom" :saving="saving" :template="templateID" @action="action" />
    <div class="workspace" :class="{ 'no-assets': !showAssets, 'no-inspector': !showInspector }">
      <AssetPalette v-show="showAssets" ref="palette" @insert="insert" @apply="applyTemplate"
        @template="applyTemplate($event.stageDatajson, $event)" @pictures="group = $event" />
      <main class="viewport" @dragover.prevent @drop.prevent="drop" @wheel="($event.ctrlKey || $event.metaKey) && ($event.preventDefault(), adjustZoom($event.deltaY < 0 ? 0.1 : -0.1))">
        <div class="viewport-controls">
          <ElButton size="small" @click="showAssets = !showAssets">{{ showAssets ? '隐藏资源' : '显示资源' }}</ElButton>
          <ElButton size="small" @click="shortcuts = true">快捷键</ElButton>
          <ElButton size="small" @click="showInspector = !showInspector">{{ showInspector ? '隐藏属性' : '显示属性' }}</ElButton>
        </div>
        <ElEmpty v-if="failed" description="无法读取画面" />
        <div v-show="!failed" class="surface" :style="{ width: dimensions.width * zoom + 'px', height: dimensions.height * zoom + 'px' }">
          <div class="canvas-content" :style="{ transform: 'scale(' + zoom + ')', width: dimensions.width + 'px', height: dimensions.height + 'px' }">
            <div id="container" ref="host"></div>
            <WidgetOverlay v-if="engine" :engine="engine" :revision="revision" editing />
          </div>
        </div>
      </main>
      <aside v-show="showInspector" class="inspector">
        <ElTabs v-model="active" stretch>
          <ElTabPane name="properties" label="属性">
            <ElScrollbar><NodeProperties v-if="config" :node="node" :engine="engine" :config="config" :revision="revision" @image="imagePicker" /></ElScrollbar>
          </ElTabPane>
          <ElTabPane name="canvas" label="画布">
            <ElScrollbar><SceneSettings v-if="engine" :engine="engine" :config="config" :revision="revision" @image="imagePicker" @conditions="conditionDialog = true" /></ElScrollbar>
          </ElTabPane>
          <ElTabPane name="communication" label="通讯">
            <ElScrollbar><SceneSettings v-if="engine" :engine="engine" :config="config" :revision="revision" communication /></ElScrollbar>
          </ElTabPane>
          <ElTabPane name="layers" label="图层">
            <ElScrollbar>
              <ElTree id="stageStructure" :data="layers" node-key="id" empty-text="暂无图元" highlight-current
                :current-node-key="node?.id()" @node-click="engine.select([$event.item])" />
            </ElScrollbar>
          </ElTabPane>
        </ElTabs>
      </aside>
    </div>
    <div v-if="menu" class="context" :style="{ left: menu.x + 'px', top: menu.y + 'px' }" @click.stop>
      <ElButton v-for="[key, label] in contextActions" :key="key" text size="small" @click="action(key)">{{ label }}</ElButton>
    </div>
    <ScenePicker v-model="scenePicker" @select="openScene" />
    <PictureManager :group="group" @close="group = null" @changed="palette.refreshPictures($event)" />
    <ElDialog v-model="conditionDialog" title="条件弹窗" width="min(980px, 95vw)">
      <RecordTable :rows="conditions" :row-template="conditionRow" @update:rows="setConditions" @bind="chooseConditionPoint" />
    </ElDialog>
    <PointPicker v-model="pointPicker" :binding="bindKey" :variables="variables" @select="onPoint($event)" />
    <ElDialog v-model="variableDialog" title="虚拟变量" width="min(950px, 95vw)">
      <VirtualVariables :model-value="variables" @update:model-value="setVariables" />
    </ElDialog>
    <ElDialog v-model="imageDialog" title="选择图片" width="min(800px, 95vw)">
      <ElSkeleton v-if="imageLoading" :rows="3" animated />
      <!-- 失败与空清单分别展示，避免上传或请求失败后一直停在骨架屏。 -->
      <ElEmpty v-else-if="imageFailed" description="图片清单加载失败">
        <ElButton @click="imagePicker(onImage)">重试</ElButton>
      </ElEmpty>
      <ElEmpty v-else-if="!imageGroups.length" description="暂无图片" />
      <ElScrollbar v-else max-height="60vh">
        <section v-for="(category, index) in imageGroups" :key="index">
          <h3>{{ category.groupName }}</h3>
          <button v-for="(item, itemIndex) in category.moduleItem" :key="itemIndex" class="image-option" type="button" @click="selectImage(item)">
            <img loading="lazy" :src="assetURL(item.iconBase64)" :alt="item.moduleName">
          </button>
        </section>
      </ElScrollbar>
    </ElDialog>
    <ElDialog v-model="shortcuts" title="快捷键" width="430px">
      <dl class="key-help">
        <dt>全选 / 复制</dt><dd>Ctrl+A / Ctrl+V</dd>
        <dt>撤销 / 恢复</dt><dd>Ctrl+Z / Ctrl+Y</dd>
        <dt>保存 / 预览</dt><dd>Ctrl+S / Ctrl+P</dd>
        <dt>删除</dt><dd>Delete</dd>
        <dt>移动 1 / 10 像素</dt><dd>方向键 / Ctrl+方向键</dd>
        <dt>画布缩放</dt><dd>Ctrl+滚轮</dd>
      </dl>
    </ElDialog>
  </div>
</template>

<style scoped lang="less">
.editor { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: 280px minmax(0, 1fr) 320px; }
.no-assets { grid-template-columns: minmax(0,1fr) 320px; }
.no-inspector { grid-template-columns: 280px minmax(0,1fr); }
.no-assets.no-inspector { grid-template-columns: minmax(0,1fr); }
.viewport { min-width: 0; overflow: auto; padding: 0 var(--ui-space-4) var(--ui-space-4); background: #eef1f7; }
.viewport-controls { position: sticky; z-index: 1; top: 0; left: 0; display: flex; justify-content: space-between; padding: var(--ui-space-2) 0; gap: var(--ui-space-2); flex-wrap: wrap; }
.surface { position: relative; margin: var(--ui-space-2) auto; border: 1px solid #97bcd3; flex: none; }
.canvas-content { position: absolute; inset: 0; transform-origin: 0 0; }
.inspector { min-width: 0; border-left: 1px solid #dce4ed; min-height: 0; overflow: hidden; }
.inspector :deep(.el-tabs) { display: flex; flex-direction: column; height: 100%; }
.inspector :deep(.el-tabs__header) { margin: 0; padding-inline: var(--ui-space-3); }
.inspector :deep(.el-tabs__content) { flex: 1; min-height: 0; }
.inspector :deep(.el-tab-pane) { height: 100%; }
.context { position: fixed; z-index: 12; padding: 3px; background: #fff; border: 1px solid #dce4ed; box-shadow: 0 5px 12px #162c421b; }
.context .el-button { display: block; width: 100%; margin: 0; }
.image-option { width: 58px; height: 54px; background: #fff; border: 1px solid #e0e8ef; border-radius: 3px; margin: 3px; cursor: pointer; }
.image-option img { width: 100%; height: 100%; object-fit: contain; }
.key-help { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-2); }
.key-help dd { margin: 0; }
</style>
