import { asRows } from '../../scene/schema.js'
import { templates, pointStyleTemplates } from './templates.js'
import { thermometer } from './thermometer.js'

export const numeric = value => value === '' || value == null || value === '---' ? null : Number(value)
const tooltipText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

// 用原图表的结构和外观配置承载实际数据，不在数据缺失时制造数值。
export function chartOption(attrs, points = [], state = {}, sampleVersion) {
  const name = String(attrs.echartURL || '').split('.').at(-1)
  const type = attrs.moduleType
  const data = points.filter(item => Number.isFinite(numeric(item.value)))
  const min = Number(attrs.minValue ?? 0)
  const max = Number(attrs.maxValue ?? 100)
  if (type === 'ECHART_THERMOMETER') {
    if (!data.length) return { series: [] }
    return thermometer(numeric(data[0].value), max, min)
  }
  const option = templates[name]?.() || { series: [] }
  const pointStyles = pointStyleTemplates[name]?.() || []
  if (/GAUGE/.test(type)) {
    for (const [index, series] of option.series.entries()) {
      series.min = min
      series.max = max
      const style = pointStyles[index] || {}
      if (type === 'ECHART_GAUGE_NEW') {
        series.axisLine.lineStyle.color[0][1] = attrs.circleColor
        series.splitLine.lineStyle.color = attrs.maxCalibrationColor
        series.axisTick.lineStyle.color = attrs.minCalibrationColor
        series.axisLabel.color = attrs.valueCalibrationColor
        series.pointer.itemStyle.color = attrs.pointerColor
        style.itemStyle = { ...style.itemStyle, color: attrs.passPointerColor }
        style.detail = { ...style.detail, color: attrs.valueColor }
      }
      if (type === 'ECHART_GAUGE4_NEW') {
        series.splitLine.lineStyle.color = attrs.maxCalibrationColor
        series.axisTick.lineStyle.color = attrs.minCalibrationColor
        series.axisLine.lineStyle.color = asRows(attrs.subsectionColor).map(row => [(Number(row.value) - min) / (max - min), row.color])
      }
      series.data = data.slice(0, 1).map(item => ({ ...style, value: numeric(item.value) }))
    }
  } else if (/realTimeLine/.test(type)) {
    state.history ||= new Map()
    // 原版首个刻度是时间占位；对应的缺失值使用 null，不伪造零值。
    state.times ||= ['--:--']
    state.latest ||= ''
    const limit = Math.max(1, Math.min(10000, Number(attrs.historyCount) || 60))
    // 连续两个实测值即使相等，也必须分别保留；外观刷新不应新增采样点。
    const key = sampleVersion ?? JSON.stringify(points)
    if (data.length && key !== state.latest) {
      state.latest = key
      state.times.push(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
      if (state.times.length > limit) state.times.shift()
      for (const item of asRows(attrs.dataKey)) {
        if (!state.history.has(item.key)) state.history.set(item.key, Array(state.times.length - 1).fill(null))
        const values = state.history.get(item.key)
        const actual = data.find(row => row.key === item.key)
        values.push(actual ? numeric(actual.value) : null)
        if (values.length > limit) values.shift()
      }
    }
    const fields = asRows(attrs.dataKey)
    const colored = type.endsWith('Z')
    if (colored) option.tooltip.formatter = items => items.length
      ? tooltipText(items[0].axisValueLabel) + ':<br/>' + items.map(item => tooltipText(item.seriesName) + ': ' + tooltipText(item.value) + '<br/>').join('') : ''
    option.legend.data = fields.map(row => colored ? { name: row.name, itemStyle: { color: row.color } } : row.name)
    option.legend.textStyle.color = attrs.titleColor
    option.xAxis.axisLine.lineStyle.color = attrs.zeroAxisColorX
    option.xAxis.axisLabel.textStyle.color = attrs.lableColorX
    option.xAxis.splitLine.lineStyle.color = attrs.verticalSplitColor
    option.yAxis.axisLabel.textStyle.color = attrs.lableColorY
    option.yAxis.splitLine.lineStyle.color = attrs.horizontalSplitColor
    option.xAxis.data = [...state.times]
    option.series = fields.map(row => ({ name: row.name, type: 'line', data: [...(state.history.get(row.key) || [])],
      ...(colored ? { lineStyle: { color: row.color }, symbolSize: 0, legendHoverLink: false } : {}) }))
  } else if (type === 'ECHART_realTimeBarGraph') {
    option.xAxis.data = data.map(item => item.name || item.key)
    option.xAxis.axisLine.lineStyle.color = attrs.zeroAxisColorX
    option.xAxis.axisLabel.textStyle.color = attrs.lableColorX
    option.yAxis.axisLabel.textStyle.color = attrs.lableColorY
    option.yAxis.splitLine.lineStyle.color = attrs.horizontalSplitColor
    option.series[0].data = data.map(item => numeric(item.value))
    option.series[0].label.formatter = params => params.value + (attrs.unit || '')
    option.series[0].label.color = attrs.BarGraphLableColor
  } else if (/PieGraph|CircularGraph/.test(type)) {
    option.legend.data = data.map(item => item.name || item.key)
    option.legend.textStyle.color = attrs.legendColor
    option.series[0].label.color = attrs.lableColor
    option.series[0].data = data.map(item => ({ name: item.name || item.key, value: numeric(item.value) }))
  } else if (type === 'ECHART_Pool') {
    option.series[0].color[0] = attrs.waterColor
    Object.assign(option.series[0].backgroundStyle, { color: attrs.backgroundColor, borderColor: attrs.borderColor, borderWidth: attrs.borderWidth })
    option.series[0].data = data.length ? [Number((numeric(data[0].value) / Number(attrs.poolHight)).toFixed(2))] : []
  } else if (type === 'ECHART_Pool2') {
    for (const index of [1, 2, 4]) option.series[index].itemStyle.normal.color = attrs.waterColor
    for (const index of [0, 3]) option.series[index].itemStyle.color = attrs.backgroundColor
    // 100 表示桶身的几何高度，不是缺失数据的补值。
    option.series[0].data = [{ ...pointStyles[0], value: 100 }]
    option.series[3].data = [100]
    if (data.length) {
      const value = Number((numeric(data[0].value) / Number(attrs.poolHight)).toFixed(2)) * 100
      option.series[1].data = [{ ...pointStyles[1], value }]
      option.series[2].data = [{ ...pointStyles[2], value: 0 }]
      option.series[4].data = [value]
    }
  }
  return option
}
