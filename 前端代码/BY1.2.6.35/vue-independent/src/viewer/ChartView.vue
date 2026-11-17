<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElEmpty } from 'element-plus'
import * as echarts from 'echarts/core'
import { BarChart, GaugeChart, LineChart, PieChart, PictorialBarChart, ScatterChart } from 'echarts/charts'
import { DatasetComponent, GridComponent, LegendComponent, TooltipComponent, TitleComponent, GraphicComponent, ToolboxComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import 'echarts-liquidfill'
import { chartOption, numeric } from './charts/options.js'

echarts.use([BarChart, GaugeChart, LineChart, PieChart, PictorialBarChart, ScatterChart, DatasetComponent, GridComponent, LegendComponent, TooltipComponent, TitleComponent, GraphicComponent, ToolboxComponent, CanvasRenderer])
const props = defineProps({ attrs: Object, points: Array, historical: Object, sampleVersion: Number })
const hasData = computed(() => props.historical
  ? props.historical.series?.some(series => series.data?.length)
  : props.points?.some(point => Number.isFinite(numeric(point.value))))
const host = ref()
let chart
let resize
// 每个图表保留独立历史，重载画面时随组件销毁。
const state = {}

function draw() {
  if (!chart) return
  if (props.historical) {
    const source = props.historical
    const type = props.attrs.moduleType.includes('BAR') ? 'bar' : 'line'
    chart.setOption({
      backgroundColor: 'transparent',
      grid: { left: 45, right: 15, top: 27, bottom: 27 },
      tooltip: { trigger: 'axis' }, legend: source.legend,
      xAxis: source.xAxis || { type: 'category', data: [] }, yAxis: source.yAxis || { type: 'value' },
      series: Array.isArray(source.series) ? source.series.map(item => ({
        type, name: item.name, data: Array.isArray(item.data) ? item.data : [],
      })) : [],
    }, true)
  } else {
    chart.setOption(chartOption(props.attrs, props.points, state, props.sampleVersion), true)
  }
}
onMounted(() => {
  // 历史报表随界面走暗色，组态图表继续使用画面里的配置。
  chart = echarts.init(host.value, props.historical ? 'dark' : undefined)
  resize = new ResizeObserver(() => chart.resize())
  resize.observe(host.value)
  draw()
})
watch(() => [props.points, props.attrs, props.historical, props.sampleVersion], draw, { deep: true })
onBeforeUnmount(() => { resize?.disconnect(); chart?.dispose() })
</script>

<template>
  <div class="chart-frame">
    <div ref="host" class="chart-host"></div>
    <!-- 缺失值有明确空态，真实 0 继续作为有效数据渲染。 -->
    <ElEmpty v-if="!hasData" class="chart-empty" :image-size="26" description="暂无数据" />
  </div>
</template>

<style scoped>
.chart-frame, .chart-host { height: 100%; width: 100%; }
.chart-frame { position: relative; }
.chart-empty { position: absolute; inset: 0; pointer-events: none; padding: 0; }
</style>
