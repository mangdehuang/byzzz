<script setup>
import { computed } from 'vue'
import { ElButton, ElCollapse, ElCollapseItem, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch } from 'element-plus'
import FieldValue from '../components/FieldValue.vue'

const props = defineProps({ engine: Object, config: Object, revision: Number, communication: Boolean })
const emit = defineEmits(['image', 'conditions'])
const attrs = computed(() => {
  void props.revision
  return props.engine.stage.attrs
})
const grid = computed(() => {
  void props.revision
  return props.engine.backdrop.findOne('.gridLine')
})
const stageSize = computed(() => attrs.value.width + '*' + attrs.value.height)
const flags = [
  ['IsBackgroundFull', '背景铺满屏幕'], ['isForcedRotation', '手机横屏强制旋转'],
  ['isStageMove', '画面缩放平移'], ['isStageCache', '监控画面缓存'],
]
const mqttFields = [['mqttUrl', 'URL 地址'], ['mqttUser', '用户名'], ['mqttPawss', '密码'], ['Topics', '订阅主题']]

function set(group, field, value) {
  if (group) attrs.value[group][field] = value
  else props.engine.stage.setAttr(field, value)
  props.engine.commit()
}

function resizePreset(value) {
  const [width, height] = value.split('*').map(Number)
  props.engine.resize(width, height)
}

function resize(key, next) {
  if (!Number.isFinite(next) || next < 10 || next > 16384) return
  props.engine.resize(key === 'width' ? next : attrs.value.width, key === 'height' ? next : attrs.value.height)
}

function background(value) {
  if (value) props.engine.backdrop.findOne('.layer_background').fill(value)
  props.engine.commit()
}

function gridChange(value, color) {
  props.engine.drawGrid(value, color || grid.value?.stroke())
  props.engine.commit()
}
</script>

<template>
  <div class="settings">
    <ElForm v-if="!communication" label-position="top" size="small" @submit.prevent>
      <ElFormItem label="画布分辨率">
        <ElSelect :model-value="stageSize" placeholder="自定义" @change="resizePreset">
          <ElOption v-for="option in config.stageResolution" :key="option.value" :value="option.value" :label="option.name" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="自定分辨率">
        <div class="row">
          <ElInputNumber id="customResolution_width" :model-value="attrs.width" :min="10" :max="16384" :controls="false" aria-label="宽" @change="resize('width', $event)" />
          <span>×</span>
          <ElInputNumber id="customResolution_height" :model-value="attrs.height" :min="10" :max="16384" :controls="false" aria-label="高" @change="resize('height', $event)" />
        </div>
      </ElFormItem>
      <ElFormItem label="画布辅助线">
        <ElSwitch :model-value="!!grid" aria-label="网格" @change="gridChange($event)" />
        <FieldValue v-if="grid" :model-value="grid.stroke()" type="color" @update:model-value="gridChange(true, $event)" />
      </ElFormItem>
      <ElFormItem label="背景颜色">
        <FieldValue :model-value="engine.backdrop.findOne('.layer_background').fill()" type="colorAlpha" @update:model-value="background" />
      </ElFormItem>
      <ElFormItem label="背景图片">
        <ElButton @click="emit('image', url => engine.backgroundImage(url))">选择</ElButton>
        <ElButton v-if="engine.backdrop.getAttr('backgroundImageURL')" plain type="danger" @click="engine.backgroundImage('')">移除</ElButton>
      </ElFormItem>
      <ElFormItem v-for="[key, label] in flags" :key="key" :label="label">
        <ElSwitch :model-value="String(attrs[key]) === '1'" :aria-label="label" @change="set('', key, $event ? '1' : '0')" />
      </ElFormItem>
      <ElFormItem label="条件弹窗">
        <ElSwitch :model-value="String(attrs.conditionInfo.conditionType) === '1'" @change="set('conditionInfo','conditionType',$event ? '1' : '0')" />
        <ElButton @click="emit('conditions')">配置规则</ElButton>
      </ElFormItem>
    </ElForm>
    <ElCollapse v-else :model-value="['ws']">
      <ElCollapseItem name="ws" title="WebSocket">
        <ElForm label-position="top" size="small" @submit.prevent>
          <ElFormItem label="是否启用">
            <ElSwitch :model-value="String(attrs.webSocket.webSocketIsOn) === '1'" @change="set('webSocket','webSocketIsOn',$event ? '1' : '0')" />
          </ElFormItem>
          <ElFormItem label="URL 地址">
            <ElInput id="websocketUrl" :model-value="attrs.webSocket.websocketUrl" placeholder="留空时使用默认地址" @input="set('webSocket','websocketUrl',$event)" />
          </ElFormItem>
        </ElForm>
      </ElCollapseItem>
      <ElCollapseItem name="mqtt" title="MQTT">
        <ElForm label-position="top" size="small" @submit.prevent>
          <ElFormItem label="是否启用">
            <ElSwitch :model-value="String(attrs.mqtt.mqttIsOn) === '1'" @change="set('mqtt','mqttIsOn',$event ? '1' : '0')" />
          </ElFormItem>
          <ElFormItem v-for="[key, label] in mqttFields" :key="key" :label="label">
            <ElInput :model-value="attrs.mqtt[key]" :type="key === 'mqttPawss' ? 'password' : 'text'"
              :show-password="key === 'mqttPawss'" @change="set('mqtt',key,$event)" />
          </ElFormItem>
        </ElForm>
      </ElCollapseItem>
      <ElCollapseItem name="control" title="反控方式">
        <ElSelect :model-value="String(attrs.controlType.type)" @change="set('controlType','type',$event)">
          <ElOption value="1" label="WebSocket" /><ElOption value="2" label="MQTT" />
        </ElSelect>
        <ElInput v-if="String(attrs.controlType.type) === '2'" :model-value="attrs.controlType.controlTopics"
          placeholder="反控主题，使用英文逗号分隔" @change="set('controlType','controlTopics',$event)" />
      </ElCollapseItem>
    </ElCollapse>
  </div>
</template>

<style scoped lang="less">
.settings { padding: var(--ui-space-3) var(--ui-space-4) var(--ui-space-6); }
.row { display: flex; width: 100%; gap: var(--ui-space-2); align-items: center; }
.settings :deep(.el-form-item__content) { gap: 8px; }
</style>
