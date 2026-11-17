<script setup>
import { computed, ref } from 'vue'
import {
  ElButton, ElCollapse, ElCollapseItem, ElDialog, ElEmpty, ElForm, ElFormItem, ElInput, ElMessage, ElSelectV2, ElSwitch,
} from 'element-plus'
import FieldValue from '../components/FieldValue.vue'
import PointPicker from '../components/PointPicker.vue'
import RecordTable from '../components/RecordTable.vue'
import ScenePicker from '../components/ScenePicker.vue'
import BehaviorSettings from './BehaviorSettings.vue'
import { asRows, literal } from '../scene/schema'
import { resource } from '../api'
import { ruleTemplate } from './rule-schema.js'
import { setNodeProperty } from '../scene/properties.js'
import { dateText } from '../scene/live.js'

const props = defineProps({ node: Object, engine: Object, config: Object, revision: Number })
const emit = defineEmits(['image'])
const open = ref(['geometry'])
const detail = ref(null)
const picker = ref(false)
const scenePicker = ref(false)
const cities = ref([])
let pointTarget

const sections = computed(() => {
  void props.revision
  const attrs = props.node?.getAttr('moduleAttr') || []
  const loose = attrs.filter(item => !item.attrGroupContent)
  return [
    { name: 'geometry', title: '位置和尺寸', fields: [
      ['x', 'X 坐标'], ['y', 'Y 坐标'], ['width', '宽度'], ['height', '高度'],
      ['rotation', '旋转'], ['scaleX', '横向缩放'], ['scaleY', '纵向缩放'],
    ].filter(([key]) => !['width', 'height'].includes(key) || props.node?.attrs[key] != null)
      .map(([attrCode, attrName]) => ({ attrCode, attrName, attrWhere: 'this', attrType: 'input' })) },
    ...attrs.filter(item => item.attrGroupContent).map((item, index) => ({
      name: 'group-' + index, title: item.attrGroupName,
      // 自动宽度模式隐藏手动宽度/对齐，与原版专用属性表保持一致。
      fields: item.attrGroupContent.filter(field => String(props.node.getAttr('widthControl')) !== '0' ||
        !['width', 'align'].includes(field.attrCode) || field.attrWhere === 'this'),
    })),
    ...(loose.length ? [{ name: 'general', title: '图元属性', fields: loose }] : []),
    { name: 'behavior', title: '事件与动效', fields: [
      ['hideWhere', '隐藏条件', 'hideTable'], ['sparklingWhere', '闪烁条件', 'sparklingTable'],
      ['basicInfo', '基本信息', 'BasicInfo'], ['clickInfo', '点击弹窗', 'ClickInfo'], ['eventBehaviour', '事件配置', 'EventConfig'],
      ['rightMenu', '右键菜单', 'RightMenu'],
    ].map(([attrCode, attrName, attrType]) => ({ attrCode, attrName, attrWhere: 'this', attrType })) },
  ]
})

const target = field => {
  if (!field.attrWhere || field.attrWhere === 'this') return [props.node]
  return field.attrWhere.split(',').map(name => props.node.findOne(node => node.hasName(name.trim()))).filter(Boolean)
}
const value = field => target(field)[0]?.getAttr(field.attrCode)

function set(field, next) {
  if (next === undefined) return
  try {
    setNodeProperty(props.node, field, next)
    if (field.attrCode === 'dateFormat') props.node.findOne('.complexTextValue')?.text(dateText(next))
  } catch (error) {
    ElMessage.warning(error.message)
    return
  }
  props.engine.prepareGroup(props.node)
  props.engine.transformer?.forceUpdate()
  if (field.attrCode === 'hideWhere' && !props.node.getAttr('hideMethodCall')) props.node.setAttr('hideMethodCall', 'hideModuleNew')
  if (field.attrCode === 'sparklingWhere' && !props.node.getAttr('sparklingMethodCall')) props.node.setAttr('sparklingMethodCall', 'sparklingModuleNew')
  props.engine.commit()
}

const isTable = field => /table|hardware/i.test(field.attrType || '') && field.attrType !== 'Table'
const isImage = field => field.attrCode === 'imageURL' || ['RotatImage', 'Image', 'image'].includes(field.attrType)
const defaultRow = ruleTemplate

function items(field) {
  const dictionaries = {
    font: props.config.fontText, fontSize: props.config.fontSize, select_dataFormat: props.config.dateFormat,
    align: ['left', 'center', 'right'].map((value, index) => ({ value, name: ['左对齐', '居中', '右对齐'][index] })),
  }
  const embedded = field.selectItem || field.selectData || field.attrData || field.options
  return asRows(embedded || dictionaries[field.attrType]).map(option => typeof option === 'object'
    ? { ...option, value: option.value ?? option.code ?? option.name }
    : { value: option })
}

function bind(field, index = 0, key = 'key') {
  const rows = asRows(value(field))
  pointTarget = { field, index, key }
  picker.value = true
  detailBinding.value = rows[index]?.[key] || ''
}

const detailBinding = ref('')
function choosePoint(point) {
  const { field, index, key } = pointTarget
  const rows = asRows(value(field)).map(row => ({ ...row }))
  const row = rows[index] || defaultRow(field)
  rows[index] = { ...row, [key]: point.key, [key === 'devicecode' ? 'devicename' : 'name']: point.name }
  saveRows(field, rows)
}

function saveRows(field, rows) {
  set(field, typeof value(field) === 'string' ? JSON.stringify(rows) : rows)
}

function setChild(field, key, next) {
  set(field, { ...literal(value(field), {}), [key]: next })
}

function chooseTarget(scene) {
  const field = detail.value
  if (field.attrCode === 'eventBehaviour') {
    setChild(field, 'behavior_picture', { targetCode: scene.stageId, targetName: scene.stageName })
  } else {
    set(field, JSON.stringify({ targetCode: scene.stageId, targetName: scene.stageName }))
  }
}

const appearance = {
  fontNew: [
    ['fontFamily', '字体'], ['fontSize', '字号'], ['fontStyle', '字形'], ['fill', '字体颜色'],
  ],
  BORDER: [
    ['stroke', '边框色'], ['strokeWidth', '边框宽度'], ['cornerRadius', '圆角'],
  ],
}
// 字体外观使用原配置字典，避免迁移后只能手工输入字体和字形。
function appearanceOptions(key) {
  if (key === 'fontFamily') return [...(props.config.fontText || []), ...(props.config.fontNum || [])]
    .map(value => typeof value === 'object' ? value : { value, name: value })
  if (key === 'fontStyle') return [...(props.config.fontStyle || []), { value: 'bold italic', name: '粗斜体' }]
  if (key === 'fontSize') return (props.config.fontSize || []).map(value => ({ value: Number(value), name: String(value) }))
  return []
}
async function loadCities(open) {
  if (open && !cities.value.length) {
    try {
      const list = await resource('weather_locations')
      cities.value = list.map(item => ({ ...item, value: item.id }))
    } catch {
      cities.value = []
    }
  }
}

function chooseCity(field, id) {
  const city = cities.value.find(item => item.id === id)
  if (city) set(field, { id: city.id, name: city.name, pinyin: city.pinyin })
}
function showField(field) {
  detail.value = field
}
</script>

<template>
  <ElEmpty v-if="!node" description="选择画布中的图元" :image-size="58" />
  <ElCollapse v-else v-model="open" class="node-props">
    <ElCollapseItem v-for="section in sections" :key="section.name" :name="section.name" :title="section.title">
      <ElForm label-position="top" size="small" @submit.prevent>
        <ElFormItem v-for="(field, index) in section.fields" :key="index" :label="field.attrName || field.attrCode">
          <template v-if="appearance[field.attrType]">
            <div class="appearance-fields">
              <label v-for="[key, label] in appearance[field.attrType]" :key="key">
                <span>{{ label }}</span>
                <FieldValue :model-value="value({ ...field, attrCode: key })"
                  :type="['fill', 'stroke'].includes(key) ? 'colorAlpha' : 'input'"
                  :options="appearanceOptions(key)"
                  @update:model-value="set({ ...field, attrCode: key }, $event)" />
              </label>
            </div>
          </template>
          <ElSelectV2 v-else-if="field.attrType === 'SelectCity'" :model-value="value(field)?.id"
            :options="cities" filterable placeholder="选择城市" @visible-change="loadCities" @change="chooseCity(field, $event)" />
          <div v-else-if="isImage(field)" class="prop-row">
            <ElInput :model-value="String(value(field) || '')" @change="set(field, $event)" />
            <ElButton @click="emit('image', url => set(field, url))">选择</ElButton>
          </div>
          <div v-else-if="isTable(field)" class="prop-row">
            <ElButton type="primary" plain @click="showField(field)">{{ asRows(value(field)).length ? '配置规则' : '配置' }}</ElButton>
            <ElButton v-if="/hardware/i.test(field.attrType)" @click="bind(field)">绑定数据点</ElButton>
          </div>
          <ElButton v-else-if="/BasicInfo|ClickInfo|EventConfig|RightMenu|jump/i.test(field.attrType || field.attrCode)" type="primary" plain @click="showField(field)">配置</ElButton>
          <FieldValue v-else :model-value="value(field)" :type="typeof value(field) === 'object' ? 'json' : field.attrType"
            :options="items(field)" @update:model-value="set(field, $event)" />
        </ElFormItem>
      </ElForm>
    </ElCollapseItem>
  </ElCollapse>
  <ElDialog :model-value="!!detail && !!node" :title="detail?.attrName || '图元配置'" width="min(900px, 95vw)" append-to-body
    @update:model-value="!$event && (detail = null)">
    <template v-if="detail && node">
      <RecordTable v-if="isTable(detail)" :rows="asRows(value(detail))" :row-template="defaultRow(detail)"
        @update:rows="saveRows(detail, $event)" @bind="(index, key) => bind(detail, index, key)" />
      <BehaviorSettings v-else-if="detail.attrCode === 'eventBehaviour'" :engine="engine" :model-value="value(detail)"
        @update:model-value="set(detail, $event)" />
      <template v-else-if="detail.attrCode === 'rightMenu'">
        <ElSwitch :model-value="String(value(detail)?.isEnable || '') !== ''" active-text="启用右键菜单"
          @change="setChild(detail, 'isEnable', $event ? '1' : '')" />
        <RecordTable :rows="asRows(value(detail)?.menuContent)"
          :row-template="{ title: '', url: '', width: 620, height: 400, interface_address: '' }"
          @update:rows="setChild(detail, 'menuContent', $event)" />
      </template>
      <template v-else-if="detail.attrCode === 'basicInfo'">
        <!-- 保留旧画面的单击展示模式，不在编辑时强制改成悬停。 -->
        <ElSelectV2 :model-value="String(value(detail)?.showType || '')" aria-label="基本信息展示方式"
          :options="[{ label: '不展示', value: '' }, { label: '悬停展示', value: '1' }, { label: '单击展示', value: '2' }]"
          @update:model-value="setChild(detail, 'showType', $event)" />
        <RecordTable :rows="asRows(value(detail)?.showContent)" :row-template="{ title: '', type: '1', value: '', unit: '' }"
          @update:rows="setChild(detail, 'showContent', $event)" />
      </template>
      <template v-else-if="detail.attrCode === 'clickInfo'">
        <!-- URL 与尺寸继续写入旧 JSON 字段，预览和监控共用。 -->
        <ElForm label-width="90px">
          <ElFormItem label="点击弹窗"><ElSwitch :model-value="!!value(detail)?.clickType && String(value(detail)?.clickType) !== '0'"
            @change="setChild(detail, 'clickType', $event ? '1' : '')" /></ElFormItem>
          <ElFormItem label="地址"><ElInput :model-value="value(detail)?.urlContent || ''"
            @update:model-value="setChild(detail, 'urlContent', $event)" /></ElFormItem>
          <ElFormItem label="宽度"><FieldValue :model-value="value(detail)?.contentWidth ?? 600" type="number"
            @update:model-value="setChild(detail, 'contentWidth', $event)" /></ElFormItem>
          <ElFormItem label="高度"><FieldValue :model-value="value(detail)?.contentHeight ?? 420" type="number"
            @update:model-value="setChild(detail, 'contentHeight', $event)" /></ElFormItem>
        </ElForm>
      </template>
      <template v-else>
        <ElButton v-if="/jump/i.test(detail.attrCode)" class="target-button" @click="scenePicker = true">选择目标画面</ElButton>
        <FieldValue :model-value="value(detail) || {}" type="json" @update:model-value="set(detail, $event)" />
      </template>
    </template>
  </ElDialog>
  <PointPicker v-model="picker" :binding="detailBinding" :variables="engine?.stage.attrs.dummyVarList || []" @select="choosePoint" />
  <ScenePicker v-model="scenePicker" @select="chooseTarget" />
</template>

<style scoped>
.node-props { padding: var(--ui-space-2) var(--ui-space-4) var(--ui-space-6); }
.prop-row, .appearance-fields { display: flex; gap: 8px; width: 100%; }
.appearance-fields { display: grid; grid-template-columns: 1fr 1fr; }
.appearance-fields label { display: grid; align-content: start; }
.target-button { margin-bottom: 8px; }
</style>
