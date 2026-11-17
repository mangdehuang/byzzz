<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { ElButton, ElDialog, ElEmpty, ElInput, ElMessage, ElMessageBox, ElSkeleton, ElTag } from 'element-plus'
import { api, resource, sceneID } from '../api'
import { SceneStage } from '../scene/stage'
import { asRows, assetURL, literal } from '../scene/schema'
import { SceneData } from '../scene/live'
import { activateNode, openExternal } from './behaviors'
import { connectStage } from './connections'
import { httpURL } from './widget-data'
import { basicInfo, clickDialog, infoValue } from './info.js'
import WidgetOverlay from './WidgetOverlay.vue'

const HistoryWidget = defineAsyncComponent(() => import('./HistoryWidget.vue'))

const props = defineProps({ preview: Boolean })
const viewport = ref()
const host = ref()
const engine = shallowRef()
const config = shallowRef()
const testData = ref('{}')
const revision = ref(0)
const sampleVersion = ref(0)
const formulaErrorCount = ref(0)
const values = shallowRef(Object.create(null))
const input = ref({})
const online = ref({ ws: '', heartbeat: '', mqtt: '' })
const dimensions = ref({ width: 1, height: 1 })
const screen = ref({ width: 1, height: 1 })
const offset = ref({ x: 0, y: 0, zoom: 1 })
const error = ref(false)
const loading = ref(true)
const isFullscreen = ref(false)
const dialog = ref(null)
const menu = ref(null)
const hover = shallowRef(null)
const id = sceneID()
let runtime
let connection
let resize
let dialogTimer
const pulses = new Set()
let drag
let suppressClick = false
let loadVersion = 0

const rotated = computed(() => engine.value && String(engine.value.stage.getAttr('isForcedRotation')) === '1' &&
  screen.value.height > screen.value.width && dimensions.value.width > dimensions.value.height)
const scale = computed(() => {
  // 原版自适应会为画布边框保留 5px，不应使用整个视口重新缩放。
  const width = Math.max(1, (rotated.value ? screen.value.height : screen.value.width) - 5)
  const height = Math.max(1, (rotated.value ? screen.value.width : screen.value.height) - 5)
  return Math.min(width / dimensions.value.width, height / dimensions.value.height) * offset.value.zoom
})
const transform = computed(() => {
  const { width, height } = dimensions.value
  const { x, y } = offset.value
  const factor = scale.value
  const moveX = (screen.value.width - (rotated.value ? height : width) * factor) / 2 + x
  const moveY = (screen.value.height - (rotated.value ? width : height) * factor) / 2 + y
  return 'translate(' + (moveX + (rotated.value ? height * factor : 0)) + 'px,' + moveY + 'px) ' +
    (rotated.value ? 'rotate(90deg) ' : '') + 'scale(' + factor + ')'
})
// 铺满背景只改变承载容器，背景图片仍按原版 100% 拉伸。
const background = computed(() => {
  if (!engine.value || String(engine.value.stage.getAttr('IsBackgroundFull')) !== '1') return {}
  const image = assetURL(engine.value.backdrop.getAttr('backgroundImageURL'))
  return image ? { backgroundImage: `url("${image}")`, backgroundSize: '100% 100%', backgroundPosition: 'center' }
    : { backgroundColor: engine.value.backdrop.findOne('.layer_background')?.fill() }
})
const title = computed(() => props.preview ? '画面预览' : '实时监控')

function cached(clear) {
  const key = 'byzt:monitor:' + id
  if (!id) return null
  try {
    if (clear) localStorage.removeItem(key)
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

async function load(clear = false) {
  const version = ++loadVersion
  runtime?.destroy()
  connection?.close()
  engine.value?.destroy()
  engine.value = null
  runtime = connection = null
  input.value = {}
  values.value = Object.create(null)
  formulaErrorCount.value = 0
  hover.value = menu.value = dialog.value = null
  clearTimeout(dialogTimer)
  pulses.forEach(timer => clearTimeout(timer))
  pulses.clear()
  offset.value = { x: 0, y: 0, zoom: 1 }
  online.value = { ws: '', heartbeat: '', mqtt: '' }
  error.value = false
  loading.value = true
  try {
    config.value ||= await resource('init')
    const draft = new URLSearchParams(location.search).get('draft')
    const saved = draft ? sessionStorage.getItem(draft) : !props.preview && cached(clear) || (await api.scene(id)).stagedatajson
    if (version !== loadVersion) return
    engine.value = new SceneStage(host.value, config.value, { activated, hovered })
    engine.value.import(saved)
    if (String(engine.value.stage.getAttr('IsBackgroundFull')) === '1') {
      // 背景交由外层铺满视口，画布内部不再叠绘同一张图片。
      engine.value.backdrop.findOne('.layer_background')?.visible(false)
      engine.value.backdrop.find('.myShapeBackgroundImage').forEach(node => node.visible(false))
    }
    dimensions.value = engine.value.stage.size()
    runtime = new SceneData(engine.value, (data, { sample = true } = {}) => {
      if (sample) values.value = { ...data }
      formulaErrorCount.value = runtime?.formulaErrors.size || 0
      if (sample) sampleVersion.value += 1
      revision.value += 1
    }, condition)
    runtime.update({})
    const attrs = engine.value.stage.attrs
    if (!props.preview && String(attrs.isStageCache) === '1') {
      try { localStorage.setItem('byzt:monitor:' + id, saved) } catch { /* 缓存配额不影响在线监控。 */ }
    }
    if (!props.preview) connection = connectStage(id, attrs, config.value, {
      data: packet => runtime.update(packet),
      status: (channel, state) => { online.value[channel] = state },
      notice: (message, type) => ElMessage({ message: String(message), type }),
    })
  } catch {
    if (version !== loadVersion) return
    runtime?.destroy()
    engine.value?.destroy()
    engine.value = null
    error.value = true
    ElMessage.error('无法读取画面')
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

// Canvas 和 HTML 覆盖图元复用同一事件入口。
function activated(node, event) {
  if (!node) { hover.value = menu.value = null; return }
  if (suppressClick) return
  if (event.type === 'contextmenu') {
    event.preventDefault()
    const rightMenu = literal(node.getAttr('rightMenu'))
    const rows = asRows(rightMenu?.menuContent)
    if (!rightMenu?.isEnable || String(rightMenu.isEnable) === '0' || !rows.length) return
    menu.value = { rows, node, x: Math.max(0, Math.min(event.clientX, window.innerWidth - 160)),
      y: Math.max(0, Math.min(event.clientY, window.innerHeight - Math.min(rows.length * 28 + 16, window.innerHeight))) }
    return
  }
  const double = ['dblclick', 'dbltap'].includes(event.type)
  const explicit = asRows(node.getAttr('eventBehaviour')).some(item => String(item.isOpenEvent) === '1' &&
    String(item.eventType || '1') === (double ? '2' : '1'))
  if (!double && (event.button == null || event.button === 0)) {
    const info = basicInfo(node, '2')
    if (info) showInfo(node, info, event)
    else hover.value = null
    const popup = !explicit && clickDialog(node.attrs)
    if (popup) { showDialog(popup.url, popup); return }
  }
  activateNode(node, event, {
    values: values.value, input: input.value, engine: engine.value, redraw: () => { revision.value += 1 },
    open: (url, mode, size) => openExternal(url, mode, size, showDialog),
    send, prompt, submit,
  })
}

function openMenu(row) {
  const point = asRows(menu.value.node.getAttr('dataKey'))[0]?.key || ''
  menu.value = null
  if (/htmlModule\/rightMenuHistoryLine\.html/.test(row.url)) {
    dialog.value = {
      title: row.title,
      width: Number(row.width) || 620,
      height: Number(row.height) || 400,
      history: { moduleType: 'HTML_IFRAME_ECHAR_Line', interface_address: row.interface_address,
        TableField: point ? [{ key: point, name: point }] : [] },
    }
    return
  }
  const url = httpURL(String(row.url || '') + encodeURIComponent(point))
  if (url) showDialog(url, { width: row.width, height: row.height, title: row.title })
}

// 单击信息保持到离开当前图元；悬停不能错误激活 showType=2。
function hovered(node, event) {
  if (hover.value?.node === node && String(hover.value.info.showType) === '2') return
  const info = basicInfo(node, '1')
  if (info) showInfo(node, info, event)
  else hover.value = null
}

function showInfo(node, info, event) {
  hover.value = { node, info,
    x: Math.max(0, Math.min(event.clientX + 12, window.innerWidth - 240)),
    y: Math.max(0, Math.min(event.clientY + 12, window.innerHeight - Math.min(asRows(info.showContent).length * 28 + 12, window.innerHeight))) }
}

function showDialog(url, size = {}) {
  clearTimeout(dialogTimer)
  dialog.value = { url, title: size.title, width: Math.max(240, Number(size.width) || 600), height: Math.max(120, Number(size.height) || 420) }
}

function condition(rule) {
  const url = httpURL(rule.urlContent)
  if (!url) return
  showDialog(url, { width: rule.contentWidth, height: rule.contentHeight })
  if (Number(rule.time) > 0) dialogTimer = setTimeout(() => { dialog.value = null }, Number(rule.time) * 1000)
}

function rawCommand(key, value) {
  const virtual = asRows(engine.value.stage.getAttr('dummyVarList')).find(item => item.id === key)
  const targets = virtual ? asRows(virtual.pointDatas).map(item => [item.hardware_code, item.hardware_cmd ?? value]) : [[key, value]]
  if (!targets.length || targets.some(([point, command]) => !point || !connection?.command(point, command))) {
    ElMessage.warning('反控通信未连接或未绑定实际数据点')
  }
}

async function submit(items, message) {
  if (props.preview) return ElMessage.info('预览模式下不发送设备指令')
  try {
    await ElMessageBox.confirm(message || '确定发送设备指令？', '设备反控')
    items.forEach(([key, value]) => rawCommand(key, value))
  } catch { /* 用户关闭确认弹窗时无需发送。 */ }
}

async function send(key, value, message, pulse) {
  if (props.preview) return ElMessage.info('预览模式下不发送设备指令')
  try {
    await ElMessageBox.confirm(message || '确定发送设备指令？', '设备反控')
    rawCommand(key, value)
    if (pulse) {
      const timer = setTimeout(() => { pulses.delete(timer); rawCommand(key, pulse.value) }, pulse.delay)
      pulses.add(timer)
    }
  } catch { /* 用户关闭确认弹窗时无需发送。 */ }
}

async function prompt(key, value, message) {
  if (props.preview) return ElMessage.info('预览模式下不发送设备指令')
  try {
    const result = await ElMessageBox.prompt(message || '请输入控制值', '设备反控', { inputValue: String(value ?? '') })
    rawCommand(key, result.value)
  } catch { /* 用户关闭输入弹窗时无需发送。 */ }
}

// JSON5 兼容旧版不带引号的点位键，禁止执行用户输入代码。
function test() {
  if (loading.value || error.value) return
  const data = literal(testData.value)
  if (!data || Array.isArray(data) || typeof data !== 'object') return ElMessage.warning('请输入点位和值的 JSON 对象')
  runtime?.update(data)
}

function canMove(event) {
  return engine.value && String(engine.value.stage.getAttr('isStageMove')) !== '0' && !rotated.value &&
    !event.target.closest('.viewer-tools,.widget,.viewer-menu,.viewer-hover,.el-overlay,button,input,textarea,a')
}

function zoom(event) {
  if (!canMove(event)) return
  event.preventDefault()
  offset.value.zoom = Math.min(6, Math.max(0.35, offset.value.zoom * (event.deltaY < 0 ? 1.1 : 0.9)))
}

function pointerDown(event) {
  suppressClick = false
  if (!event.isPrimary) { drag = null; return }
  if (!canMove(event) || event.button !== 0) return
  // 轻点仍交给图元；超过拖动阈值才捕获指针，避免拖动画面时误下发命令。
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: { ...offset.value }, moved: false }
}

function pointerMove(event) {
  if (!drag || event.pointerId !== drag.id) return
  const x = event.clientX - drag.x
  const y = event.clientY - drag.y
  if (!drag.moved && Math.hypot(x, y) < 5) return
  drag.moved = true
  hover.value = menu.value = null
  viewport.value.setPointerCapture(event.pointerId)
  offset.value = { ...drag.offset, x: drag.offset.x + x, y: drag.offset.y + y }
}

function pointerEnd(event) {
  if (!drag || event.pointerId !== drag.id) return
  suppressClick = drag.moved
  drag = null
  if (viewport.value.hasPointerCapture(event.pointerId)) viewport.value.releasePointerCapture(event.pointerId)
}

function captureClick(event) {
  if (!suppressClick || event.target.closest('.viewer-tools,.widget,.el-overlay')) return
  suppressClick = false
  event.preventDefault()
  event.stopPropagation()
}

function syncFullscreen() {
  isFullscreen.value = !!(document.fullscreenElement || document.webkitFullscreenElement)
}

async function fullscreen() {
  try {
    if (isFullscreen.value) await (document.exitFullscreen || document.webkitExitFullscreen).call(document)
    else await (viewport.value.requestFullscreen || viewport.value.webkitRequestFullscreen).call(viewport.value)
    syncFullscreen()
  } catch { ElMessage.warning('浏览器无法切换全屏') }
}

function resetView() {
  offset.value = { x: 0, y: 0, zoom: 1 }
  hover.value = menu.value = null
}

function escape(event) {
  if (event.key === 'Escape') hover.value = menu.value = null
}

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreen)
  document.addEventListener('webkitfullscreenchange', syncFullscreen)
  document.addEventListener('keydown', escape)
  syncFullscreen()
  resize = new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect
    screen.value = { width, height }
    // 尺寸和朝向变化后恢复适配，不重载画面或丢失已输入的测试点位。
    resetView()
    drag = null
  })
  resize.observe(viewport.value)
  load()
})
onBeforeUnmount(() => {
  loadVersion += 1
  document.removeEventListener('fullscreenchange', syncFullscreen)
  document.removeEventListener('webkitfullscreenchange', syncFullscreen)
  document.removeEventListener('keydown', escape)
  resize?.disconnect()
  runtime?.destroy()
  engine.value?.destroy()
  connection?.close()
  clearTimeout(dialogTimer)
  pulses.forEach(timer => clearTimeout(timer))
})
</script>

<template>
  <main ref="viewport" class="viewer" :style="background" @wheel="zoom" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerEnd" @pointercancel="pointerEnd" @lostpointercapture="pointerEnd" @click.capture="captureClick" @click="menu = null">
    <div class="viewer-tools" :class="{ 'preview-tools': preview }" :aria-label="title" role="toolbar">
      <ElButton id="full" size="small" :title="isFullscreen ? '退出全屏' : '全屏'" :aria-pressed="isFullscreen" @click="fullscreen">{{ isFullscreen ? '退出全屏' : '全屏' }}</ElButton>
      <ElButton size="small" @click="resetView">还原</ElButton>
      <template v-if="preview">
        <!-- 预览数据栏铺满剩余宽度，多行内容在输入区内滚动。 -->
        <ElInput id="stageDatajson" v-model="testData" type="textarea" :rows="1" resize="none"
          aria-label="预览测试数据" size="small" @keydown.ctrl.enter.prevent="test" @keydown.meta.enter.prevent="test" />
        <ElButton size="small" type="primary" :disabled="loading || error" @click="test">发送测试数据</ElButton>
      </template>
      <template v-else>
        <ElButton size="small" @click="load(true)">刷新画面</ElButton>
        <ElTag v-if="online.ws" id="ljzt" size="small">WebSocket {{ online.ws }}</ElTag>
        <ElTag v-if="online.heartbeat" id="xtzt" size="small" type="success">心跳 {{ online.heartbeat }}</ElTag>
        <ElTag v-if="online.mqtt" id="mqttzt" size="small">MQTT {{ online.mqtt }}</ElTag>
      </template>
      <ElTag v-if="formulaErrorCount" type="warning" size="small">{{ formulaErrorCount }} 个虚拟变量计算异常</ElTag>
    </div>
    <!-- 画布局部状态保留工具栏，加载失败可直接重试。 -->
    <ElSkeleton v-if="loading" class="viewer-loading" :rows="4" animated />
    <ElEmpty v-else-if="error" class="viewer-empty" description="画面无法加载">
      <ElButton @click="load(true)">重新加载</ElButton>
    </ElEmpty>
    <div v-show="!loading && !error" class="stage" :style="{ width: dimensions.width + 'px', height: dimensions.height + 'px', transform }">
      <div id="container" ref="host"></div>
      <WidgetOverlay v-if="engine" :engine="engine" :values="values" :input="input" :revision="revision" :sample-version="sampleVersion" :scene-i-d="id"
        @activate="activated" @hover="hovered" @command="send" @value="(key, value) => { input[key] = value }" />
    </div>
    <div v-if="menu" class="viewer-menu" role="menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }" @click.stop>
      <ElButton v-for="(row, index) in menu.rows" role="menuitem" :key="index" text size="small" @click="openMenu(row)">{{ row.title }}</ElButton>
    </div>
    <dl v-if="hover" class="viewer-hover" role="tooltip" :style="{ left: hover.x + 'px', top: hover.y + 'px' }">
      <template v-for="(row,index) in asRows(hover.info.showContent)" :key="index">
        <dt>{{ row.title }}</dt><dd>{{ infoValue(row, values) }}</dd>
      </template>
    </dl>
    <ElDialog :model-value="!!dialog" :title="dialog?.title || '信息'" :width="'min(' + (dialog?.width || 600) + 'px, 95vw)'"
      @update:model-value="!$event && (dialog = null)">
      <div v-if="dialog?.history" :style="{ height: dialog.height + 'px' }"><HistoryWidget :attrs="dialog.history" :scene-i-d="id" /></div>
      <iframe v-else-if="dialog" :src="dialog.url" :style="{ height: 'min(' + dialog.height + 'px, 76vh)' }" title="组态弹窗"></iframe>
    </ElDialog>
  </main>
</template>

<style scoped lang="less">
.viewer { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--ui-workspace); }
// 桌面操作条统一 14px/32px；窄屏将数据输入放到独立一行，避免挤压文字。
.viewer-tools { position: absolute; z-index: 5; top: var(--ui-space-3); left: var(--ui-space-3); right: var(--ui-space-3); display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2); padding: var(--ui-space-2); border: 1px solid var(--ui-border); border-radius: 8px; background: var(--ui-surface); box-shadow: var(--ui-floating-shadow); pointer-events: none; }
.viewer-tools > * { pointer-events: auto; }
.viewer-tools .el-button + .el-button { margin-left: 0; }
.preview-tools { align-items: flex-start; }
.preview-tools :deep(.el-textarea) { flex: 1; width: 0; min-width: 120px; }
.preview-tools :deep(.el-textarea__inner) { min-height: var(--ui-control-height) !important; max-height: 96px; padding: 4px 8px; font-size: var(--ui-font-body); line-height: var(--ui-line-body); background: var(--ui-surface); }
.preview-tools > .el-button { flex-shrink: 0; }
@media (max-width: 600px) {
  .viewer-tools { top: var(--ui-space-2); left: var(--ui-space-2); right: var(--ui-space-2); }
  .preview-tools :deep(.el-textarea) { order: 1; flex: 1 0 100%; width: 100%; }
  .preview-tools > .el-button--primary { margin-left: auto; }
}
.stage { position: absolute; inset: 0 auto auto 0; transform-origin: 0 0; touch-action: none; outline: 1px solid var(--ui-control-border); }
.viewer-loading { position: absolute; top: 30%; left: 15%; width: 70%; }
.viewer-empty { position: absolute; inset: 20% 0 auto; }
.viewer-menu, .viewer-hover { position: fixed; z-index: 7; padding: var(--ui-space-2); margin: 0; background: var(--ui-surface-raised); border: 1px solid var(--ui-border); border-radius: var(--ui-radius); box-shadow: var(--ui-floating-shadow); }
.viewer-menu { max-width: 100vw; max-height: 100vh; overflow: auto; min-width: 150px; }
.viewer-menu .el-button { display: block; width: 100%; margin: 0; }
.viewer-hover { max-width: min(360px, 100vw); max-height: 100vh; overflow: auto; overflow-wrap: anywhere; font-size: 14px; pointer-events: none; display: grid; grid-template-columns: auto auto; gap: var(--ui-space-2) var(--ui-space-3); }
.viewer-hover dt { color: var(--ui-accent); }
.viewer-hover dd { margin: 0; }
.viewer :deep(iframe) { width: 100%; border: 0; }
</style>
