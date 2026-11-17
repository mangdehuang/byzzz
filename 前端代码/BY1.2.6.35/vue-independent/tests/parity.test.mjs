import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { SceneDouble } from './helpers/scene-double.mjs'
import { dateText, initializeDisplay, paintValue, pointValues } from '../src/scene/live.js'
import { activateNode } from '../src/viewer/behaviors.js'

const baseline = JSON.parse(readFileSync(new URL('./fixtures/legacy-animation.json', import.meta.url)))
for (const entry of baseline.cases) {
  test('original animation attributes ' + entry.name, () => {
    const node = new SceneDouble(entry.model)
    paintValue(node, entry.value, { point: entry.value }, [{ key: 'point', value: entry.value }])
    assert.deepEqual(node.snapshot(), entry.expected)
  })
}

test('switch sends the command of the current state, including numeric zero', () => {
  const sent = []
  const node = { attrs: { moduleType: 'IMAGES_SWITCH_NEW', dataKey: [{ key: 'switch' }],
    where: [{ status: '0', command: 0 }, { status: '1', command: 'close' }] } }
  activateNode(node, { type: 'click', button: 0 }, { values: { switch: 0 }, send: (...args) => sent.push(args) })
  assert.deepEqual(sent, [['switch', 0]])
})

test('old pulse buttons keep start, delay and end values', () => {
  const sent = []
  const node = { attrs: { moduleType: 'BUTTON_IMPULSES', dataKey: [{ key: 'relay' }],
    clickSignalsWhere: [{ start: 1, time: 0.5, end: 0 }] } }
  activateNode(node, { type: 'click', button: 0 }, { send: (...args) => sent.push(args) })
  assert.deepEqual(sent, [['relay', 1, undefined, { value: 0, delay: 500 }]])
})

test('old link buttons open links without a bound point', () => {
  const opened = []
  activateNode({ attrs: { moduleType: 'BUTTON', clickWhere: [{ code: '2', content: 'https://example.com' }] } },
    { type: 'click', button: 0 }, { open: (...args) => opened.push(args) })
  assert.deepEqual(opened, [['https://example.com', '1']])
})

test('date formats and legacy single-point matching are preserved', () => {
  assert.equal(dateText('YYYY-mm-dd WW WWW', new Date(2026, 10, 15)), '2026-11-15 周日 星期日')
  assert.deepEqual(pointValues({ getAttr: () => [{ key: '' }] }, { other: 0 }), [{ key: 'other', name: 'other', value: 0 }])
})

// 初始显示必须使用画面配置的默认值，而不是图元清单中的编辑占位符。
test('viewer initialization removes editor placeholder text', () => {
  const node = new SceneDouble({ className: 'Group', attrs: { moduleType: 'VALUE', defaultValue: '0' }, children: [
    { className: 'Text', attrs: { name: 'complexTextValue', text: '##.##', fontSize: 20 } },
    { className: 'Rect', attrs: { name: 'text_border', width: 99 } },
  ] })
  initializeDisplay(node)
  assert.equal(node.findOne('.complexTextValue').text(), '0')
  assert.equal(node.findOne('.text_border').width(), node.findOne('.complexTextValue').width())
})

// 从实际基础图元清单逐项核对规则字段，而非根据新模板自己构造预期。
const catalog = JSON.parse(readFileSync(new URL('../public/byzt/config/module_config_base.json', import.meta.url)))
const { ruleTemplate } = await import('../src/editor/rule-schema.js')
test('new rule rows retain every field from original table schemas', () => {
  for (const group of catalog) for (const item of group.moduleItem) {
    const model = item.moduleJson
    for (const section of model.attrs.moduleAttr || []) for (const field of section.attrGroupContent || [section]) {
      if (!/table|hardware/i.test(field.attrType || '')) continue
      const rows = model.attrs[field.attrCode]
      if (!Array.isArray(rows) || !rows[0]) continue
      const template = ruleTemplate(field)
      for (const key of Object.keys(rows[0])) {
        assert.ok(Object.hasOwn(template, key), `${model.attrs.moduleType}.${field.attrCode}: missing ${key}`)
      }
    }
  }
})

const { SceneData } = await import('../src/scene/live.js')
test('flashing follows the original 200ms visibility cycle and restores visibility', () => {
  const originalRAF = globalThis.requestAnimationFrame
  const originalCancel = globalThis.cancelAnimationFrame
  globalThis.requestAnimationFrame = () => 1
  globalThis.cancelAnimationFrame = () => {}
  try {
    const node = new SceneDouble({ className: 'Group', attrs: {
      moduleType: 'VALUE', visible: true, sparklingWhere: [{ devicecode: 'state', min: '1', max: '1' }],
    } })
    node.visible = function(value) { return value === undefined ? this.attrs.visible : this.setAttr('visible', value) }
    const engine = { stage: { getAttr() {}, batchDraw() {} }, groups: () => [node] }
    const runtime = new SceneData(engine, () => {}, () => {})
    runtime.update({ state: 1 })
    runtime.tick(0)
    assert.equal(node.visible(), true)
    runtime.tick(199)
    assert.equal(node.visible(), true)
    runtime.tick(200)
    assert.equal(node.visible(), false)
    runtime.tick(400)
    assert.equal(node.visible(), true)
    runtime.tick(600)
    runtime.update({ state: 0 })
    assert.equal(node.visible(), true)
    runtime.destroy()
  } finally {
    globalThis.requestAnimationFrame = originalRAF
    globalThis.cancelAnimationFrame = originalCancel
  }
})
