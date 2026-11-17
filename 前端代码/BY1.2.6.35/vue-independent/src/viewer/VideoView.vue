<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({ source: String })
const player = ref()
const failed = ref(false)
let playback
let revision = 0

async function attach() {
  const current = ++revision
  playback?.destroy()
  playback = undefined
  failed.value = false
  await nextTick()
  if (!props.source || !player.value) return
  if (/\.m3u8(?:[?#]|$)/i.test(props.source) && !player.value.canPlayType('application/vnd.apple.mpegurl')) {
    const { default: Hls } = await import('hls.js')
    if (current !== revision) return
    if (!Hls.isSupported()) { failed.value = true; return }
    playback = new Hls()
    playback.loadSource(props.source)
    playback.attachMedia(player.value)
    playback.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) failed.value = true })
  } else {
    player.value.src = props.source
  }
}
watch(() => props.source, attach, { immediate: true })
onBeforeUnmount(() => { revision += 1; playback?.destroy() })
</script>

<template>
  <video v-if="source && !failed" ref="player" controls muted playsinline @error="failed = true"></video>
  <span v-else class="empty-media">{{ failed ? '视频暂不可用' : '未配置视频地址' }}</span>
</template>

<style scoped>
video { display: block; width: 100%; height: 100%; object-fit: contain; background: #14212c; }
.empty-media { display: grid; place-content: center; height: 100%; background: #eaf1f7; }
</style>
