<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { ElEmpty, ElInput, ElOption, ElSelect } from 'element-plus'
import { asRows, assetURL, literal } from '../scene/schema'
import { pointValues } from '../scene/live'
import { fieldURL, httpURL } from './widget-data'

const ChartView = defineAsyncComponent(() => import('./ChartView.vue'))
const HistoryWidget = defineAsyncComponent(() => import('./HistoryWidget.vue'))
const VideoView = defineAsyncComponent(() => import('./VideoView.vue'))
const CameraView = defineAsyncComponent(() => import('./CameraView.vue'))

const props = defineProps({
  engine: Object, values: { type: Object, default: () => ({}) }, revision: Number, sampleVersion: Number, sceneID: String, editing: Boolean, input: Object,
})
const emit = defineEmits(['command', 'value', 'activate', 'hover'])
const kinds = {
  HTML_IFRAME: '网页', LIVE_IMAGES: '实时监控', MONITOR_IMAGES: '高级监控', SPBF_IMAGES: '视频播放',
  WEATHER_IMAGES: '天气', INPUT_FORM: '输入框', SwitchGear: '多档开关',
}
const historyTypes = new Set(['HTML_IFRAME_Table', 'HTML_IFRAME_ECHAR_BAR', 'HTML_IFRAME_ECHAR_Line', 'HTML_IFRAME_ALERT_MESSAGE'])
const pointCache = new WeakMap()

// 动画只改变覆盖层位置，同一数据包不重复重建图表输入或触发 setOption。
function pointsFor(node) {
  const previous = pointCache.get(node)
  const binding = node.getAttr('dataKey')
  if (previous?.values === props.values && previous.binding === binding && !props.editing) return previous.points
  const points = pointValues(node, props.values)
  pointCache.set(node, { values: props.values, binding, points })
  return points
}

const widgets = computed(() => {
  void props.revision
  return (props.engine?.groups() || []).filter(node => {
    const type = node.getAttr('moduleType')
    return node.isVisible() && (type.startsWith('ECHART_') || historyTypes.has(type) || Object.hasOwn(kinds, type))
  }).map(node => {
    const attrs = node.attrs
    const type = attrs.moduleType
    const bounds = node.getClientRect({ skipTransform: true })
    const inputBorder = type === 'INPUT_FORM' ? node.findOne('.input_border') : null
    const inputText = type === 'INPUT_FORM' ? node.findOne('.input_value') : null
    const width = inputBorder ? inputBorder.width() : Number(attrs.width) || bounds.width || 200
    const height = inputBorder ? inputBorder.height() : Number(attrs.height) || bounds.height || 100
    const transform = node.getAbsoluteTransform().copy().translate(inputBorder ? inputBorder.x() : bounds.x || 0, inputBorder ? inputBorder.y() : bounds.y || 0)
    return {
      node, attrs, type, placeholder: inputText?.text(), formStyle: inputText ? {
        '--viewer-input-font': Math.max(12, inputText.fontSize()) + 'px',
        '--viewer-input-color': inputText.fill(), '--viewer-input-family': inputText.fontFamily(),
        '--viewer-input-align': inputText.align(), '--viewer-input-padding': inputText.padding() + 'px',
      } : {}, id: node.id(), points: pointsFor(node),
      style: { width: width + 'px', height: height + 'px', transform: 'matrix(' + transform.getMatrix().join(',') + ')', opacity: node.getAbsoluteOpacity() },
      kind: type.startsWith('ECHART_') ? 'chart' : historyTypes.has(type) ? 'history' : type,
    }
  })
})

// DOM 图元不经过 Konva 命中检测，主动转发到预览共享的交互入口。
function activate(item, event) {
  if (!props.editing) emit('activate', item.node, event)
}
function hover(item, event) {
  if (!props.editing) emit('hover', item?.node || null, event)
}

function inputValue(item) {
  if (item.type === 'SwitchGear') return literal(item.attrs.currentSelect)?.value ?? ''
  return props.input?.[item.id] ?? item.points[0]?.value ?? item.attrs.defaultValue ?? ''
}

function command(item, value) {
  const choice = asRows(item.attrs.gearConfig).find(row => String(row.value) === String(value))
  const key = asRows(item.attrs.sendKey)[0]?.key || asRows(item.attrs.dataKey)[0]?.key
  if (choice && key) emit('command', key, choice.cmd ?? choice.value)
}

function embed(item) {
  const raw = fieldURL(item.attrs.iframeSrc, item.attrs.urlParam, props.values)
  if (!raw || item.type !== 'WEATHER_IMAGES') return raw
  const url = new URL(raw)
  for (const [key, value] of Object.entries({ site: 13, py: item.attrs.city?.pinyin,
    color: item.attrs.weatherColor, bgc: item.attrs.backgroundColor })) {
    if (value != null && value !== '') url.searchParams.set(key, value)
  }
  return url.href
}
</script>

<template>
  <div class="widget-layer" :class="{ editing }">
    <div v-for="item in widgets" :key="item.id" class="widget" :style="item.style" :data-widget="item.type"
      @click="activate(item, $event)" @dblclick="activate(item, $event)"
      @contextmenu.prevent="activate(item, $event)" @mousemove="hover(item, $event)" @mouseleave="hover(null, $event)">
      <img v-if="editing && item.kind === 'chart' && item.attrs.echartIcon" class="chart-editor-icon" :src="assetURL(item.attrs.echartIcon)" alt="图表">
      <ChartView v-else-if="item.kind === 'chart'" :attrs="item.attrs" :points="item.points" :sample-version="sampleVersion" />
      <div v-else-if="editing" class="widget-placeholder">{{ kinds[item.type] || '历史数据组件' }}</div>
      <HistoryWidget v-else-if="item.kind === 'history'" :attrs="item.attrs" :scene-i-d="sceneID" />
      <template v-else-if="item.kind === 'HTML_IFRAME' || item.kind === 'WEATHER_IMAGES'">
        <iframe v-if="embed(item)" :src="embed(item)" :title="kinds[item.type]" loading="lazy" />
        <ElEmpty v-else :image-size="25" description="未配置地址" />
      </template>
      <CameraView v-else-if="item.kind === 'MONITOR_IMAGES' && !item.attrs.liveSrc" :attrs="item.attrs" :id="item.id" />
      <VideoView v-else-if="['LIVE_IMAGES','SPBF_IMAGES','MONITOR_IMAGES'].includes(item.kind)" :source="httpURL(item.attrs.liveSrc)" />
      <ElInput v-else-if="item.kind === 'INPUT_FORM'" class="scene-input" :style="item.formStyle" :placeholder="item.placeholder" :model-value="String(inputValue(item))"
        :readonly="String(item.attrs.readWriteFlag) === '1'" @input="emit('value', item.id, $event)" />
      <ElSelect v-else-if="item.kind === 'SwitchGear'" :model-value="String(inputValue(item))" @change="command(item, $event)">
        <ElOption v-for="row in asRows(item.attrs.gearConfig)" :key="row.value" :label="row.name" :value="String(row.value)" />
      </ElSelect>
    </div>
  </div>
</template>

<style scoped>
.widget-layer { position: absolute; inset: 0; pointer-events: none; }
.widget { position: absolute; inset: 0 auto auto 0; transform-origin: 0 0; pointer-events: auto; overflow: hidden; }
.editing .widget { pointer-events: none; }
.chart-editor-icon { display: block; width: 100%; height: 100%; object-fit: fill; }
.widget iframe { display: block; width: 100%; height: 100%; border: 0; }
.scene-input { height: 100%; }
.scene-input :deep(.el-input__wrapper) { height: 100%; background: transparent; box-shadow: none; padding: 0 var(--viewer-input-padding, 10px); }
.scene-input :deep(.el-input__inner) { height: 100%; color: var(--viewer-input-color); font-family: var(--viewer-input-family); font-size: var(--viewer-input-font, 18px); text-align: var(--viewer-input-align, center); }
.widget-placeholder { display: grid; place-content: center; background: #e4eff8dc; height: 100%; border: 1px dashed #90b0c9; font-size: var(--ui-font-body); }
</style>
