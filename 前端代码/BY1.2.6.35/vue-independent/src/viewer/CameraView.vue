<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElEmpty, ElSkeleton } from 'element-plus'

const props = defineProps({ attrs: Object, id: String })
const host = ref()
const state = ref('')
const configured = computed(() => props.attrs?.deviceSerial && (props.attrs.accessToken || props.attrs.appKey && props.attrs.appSecret))
let player
let controller

async function tokenFor(attrs, signal) {
  if (attrs.accessToken) return attrs.accessToken
  // 与原画面相同，已配置的账号参数只发送到萤石的令牌服务。
  const response = await fetch('https://open.ys7.com/api/lapp/token/get', {
    method: 'POST',
    body: new URLSearchParams({ appKey: attrs.appKey, appSecret: attrs.appSecret }),
    signal,
  })
  const payload = await response.json()
  if (!response.ok || String(payload.code) !== '200' || !payload.data?.accessToken) throw new Error('摄像头授权失败')
  return payload.data.accessToken
}

function stop() {
  controller?.abort()
  if (player) {
    Promise.resolve(player.destroy()).catch(() => {})
    player = undefined
  }
}

async function start() {
  stop()
  state.value = ''
  if (!configured.value) return
  const current = controller = new AbortController()
  state.value = 'loading'
  await nextTick()
  try {
    const attrs = props.attrs
    const [accessToken, { EZUIKitPlayer }] = await Promise.all([tokenFor(attrs, current.signal), import('ezuikit-js')])
    if (current.signal.aborted || !host.value) return
    const user = attrs.checkCode ? encodeURIComponent(attrs.checkCode) + '@' : ''
    const channel = Number(attrs.channelNo) || 1
    player = new EZUIKitPlayer({
      id: host.value.id,
      width: host.value.clientWidth,
      height: host.value.clientHeight,
      accessToken,
      url: 'ezopen://' + user + 'open.ys7.com/' + encodeURIComponent(attrs.deviceSerial) + '/' + channel + '.live',
      staticPath: '/byzt/camera-sdk',
      handleError() { if (!current.signal.aborted) state.value = 'failed' },
    })
    state.value = 'ready'
  } catch (error) {
    if (error.name !== 'AbortError') state.value = 'failed'
  }
}

watch(() => [props.attrs?.deviceSerial, props.attrs?.checkCode, props.attrs?.accessToken, props.attrs?.appKey, props.attrs?.appSecret], start, { immediate: true })
onBeforeUnmount(stop)
</script>

<template>
  <div class="camera">
    <div v-if="configured" :id="'camera-' + id" ref="host" class="camera-host"></div>
    <ElSkeleton v-if="state === 'loading'" class="camera-state" :rows="2" animated />
    <ElEmpty v-else-if="!configured || state === 'failed'" class="camera-state" :image-size="32"
      :description="state === 'failed' ? '摄像头无法播放' : '未配置摄像头'" />
  </div>
</template>

<style scoped>
.camera { width: 100%; height: 100%; position: relative; background: var(--ui-surface); }
.camera-host, .camera-state { position: absolute; inset: 0; }
</style>
