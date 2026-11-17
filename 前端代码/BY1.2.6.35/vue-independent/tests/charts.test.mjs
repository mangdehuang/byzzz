import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { templates, pointStyleTemplates } from '../src/viewer/charts/templates.js'
import { chartOption } from '../src/viewer/charts/options.js'

const baseline = JSON.parse(readFileSync(new URL('./fixtures/legacy-chart-styles.json', import.meta.url)))
const normalize = value => JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'function' ? item.toString().replaceAll('debugger;', '') : item))
for (const [name, expected] of Object.entries(baseline)) test('original chart appearance ' + name, () => {
  assert.deepEqual(normalize({ option: templates[name](), pointStyles: pointStyleTemplates[name]() }), expected)
})
const models = JSON.parse(readFileSync(new URL('../public/byzt/config/module_config_base.json', import.meta.url)))
  .flatMap(group => group.moduleItem.map(item => item.moduleJson)).filter(model => model.attrs.moduleType.startsWith('ECHART_'))
for (const model of models) test('chart binding accepts zero for ' + model.attrs.echartURL, () => {
  const attrs = { ...model.attrs, dataKey: [{ key: 'p', name: '实际点位' }] }
  const option = chartOption(attrs, [{ key: 'p', name: '实际点位', value: 0 }], {})
  assert.ok(option.series.length > 0)
  assert.doesNotThrow(() => JSON.stringify(option))
  if (attrs.moduleType.includes('GAUGE')) assert.equal(option.series[0].data[0].value, 0)
})

test('layered gauge and liquid tank retain all original series', () => {
  const gauge = models.find(model => model.attrs.echartURL.endsWith('.gauge5'))
  assert.equal(chartOption(gauge.attrs, [{ value: 42 }]).series.length, 2)
  const tank = models.find(model => model.attrs.moduleType === 'ECHART_Pool2')
  assert.equal(chartOption(tank.attrs, [{ value: 0 }]).series.length, 5)
  const thermal = models.find(model => model.attrs.moduleType === 'ECHART_THERMOMETER')
  assert.equal(chartOption(thermal.attrs, [{ value: 30 }]).series.length, 7)
})
test('custom gauge limits and segment colors survive point changes', () => {
  const gauge = models.find(model => model.attrs.moduleType === 'ECHART_GAUGE4_NEW')
  const attrs = { ...gauge.attrs, minValue: -50, maxValue: 50, subsectionColor: [{ value: 0, color: '#ff0000' }, { value: 50, color: '#00ff00' }] }
  const series = chartOption(attrs, [{ value: 0 }]).series[0]
  assert.equal(series.min, -50)
  assert.equal(series.max, 50)
  assert.deepEqual(series.axisLine.lineStyle.color, [[0.5, '#ff0000'], [1, '#00ff00']])
})
test('chart history follows configured retention and does not append on style-only edits', () => {
  const model = models.find(model => model.attrs.moduleType === 'ECHART_realTimeLineNewZ')
  const attrs = { ...model.attrs, historyCount: 2, dataKey: [{ key: 'p', name: '功率', color: '#ff0000' }] }
  const state = {}
  for (const value of [0, 1, 2]) chartOption(attrs, [{ key: 'p', value }], state)
  const option = chartOption({ ...attrs, titleColor: '#ffffff' }, [{ key: 'p', value: 2 }], state)
  assert.deepEqual(option.series[0].data, [1, 2])
  assert.equal(option.xAxis.data.length, 2)
  assert.equal(option.legend.textStyle.color, '#ffffff')
})
test('unavailable chart points remain empty', () => {
  const gauge = models.find(model => model.attrs.moduleType === 'ECHART_GAUGE_NEW')
  for (const value of [undefined, null, '', '---']) assert.deepEqual(chartOption(gauge.attrs, [{ value }]).series[0].data, [])
})

test('identical values from distinct packets append history while redraws do not', () => {
  const model = models.find(model => model.attrs.moduleType === 'ECHART_realTimeLineNew')
  const attrs = { ...model.attrs, dataKey: [{ key: 'p', name: '功率' }] }
  const state = {}
  chartOption(attrs, [{ key: 'p', value: 4 }], state, 1)
  const second = chartOption(attrs, [{ key: 'p', value: 4 }], state, 2)
  assert.deepEqual(second.series[0].data, [null, 4, 4])
  assert.deepEqual(chartOption(attrs, [{ key: 'p', value: 4 }], state, 2).series[0].data, [null, 4, 4])
})

test('custom line tooltips display names as text', () => {
  const model = models.find(model => model.attrs.moduleType === 'ECHART_realTimeLineNewZ')
  const option = chartOption(model.attrs, [])
  const html = option.tooltip.formatter([{ axisValueLabel: '12:00', seriesName: '<img src=x onerror=alert(1)>', value: 0 }])
  assert.ok(html.includes('&lt;img'))
  assert.ok(!html.includes('<img'))
})
