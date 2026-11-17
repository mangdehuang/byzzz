import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { calculate } from '../src/scene/formulas.js'
import { dataKeys, defaultScene, loadScene } from '../src/scene/schema.js'

const config = { webSocketUrl: '/websocket/message', mqttUrl: '' }

test('existing Stage format keeps original point rules and drops editor handles', () => {
  const original = defaultScene(config)
  original.attrs.dummyVarList = [{ id: 'DVAR01', name: '虚拟量', pointDatas: [{ hardware_code: 'device_b_status', hardware_cmd: 0 }] }]
  original.children[1].children.push({
    className: 'Group',
    attrs: { id: 'old-node', moduleType: 'VALUE', dataKey: "[{key:'device_a_value', name:'功率'}]" },
    children: [
      { className: 'Text', attrs: { text: '原文字' } },
      { className: 'Circle', attrs: { name: 'edit_anchor_1' } },
    ],
  })
  const restored = loadScene(JSON.stringify(original), config)
  assert.equal(restored.children[1].children[0].attrs.id, 'old-node')
  assert.equal(restored.children[1].children[0].children.length, 1)
  assert.deepEqual(dataKeys(restored), ['device_b_status', 'device_a_value'])
})

test('virtual formulas preserve zero and do not execute arbitrary JS', () => {
  assert.equal(calculate('const factor = 2; return Math.round({{x}} * factor);', { x: 0 }), 0)
  assert.equal(calculate('return {{x}} > 0 ? 2 : 0', { x: -1 }), 0)
  assert.throws(() => calculate('return document.cookie', {}))
  assert.throws(() => calculate('return Math.constructor("return 1")()', {}))
  assert.equal(calculate('let factor = 2\nreturn {{x}} * factor', { x: 3 }), 6)
})

test('virtual formula inputs are included in the scene subscription keys', () => {
  const scene = defaultScene(config)
  scene.attrs.dummyVarList = [{ id: 'DVAR01', script: 'return {{power}} * 2', pointDatas: [] }]
  assert.deepEqual(dataKeys(scene), ['power'])
})

test('built-in catalog is complete and its local assets are independently available', () => {
  const root = new URL('../public/byzt/', import.meta.url)
  const manifests = [
    ['module_config_base', 100, 'moduleItem'], ['module_config', 406, 'moduleItem'],
    ['module_config_decoration', 341, 'moduleItem'], ['module_stage', 2, 'moduleStageItem'],
  ]
  const missing = new Set()
  function visit(value) {
    if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') Object.values(value).forEach(visit)
    else if (typeof value === 'string' && value.startsWith('config/') && value.length < 260) {
      const path = fileURLToPath(root) + value
      if (!existsSync(path)) missing.add(value)
    } else if (typeof value === 'string' && /^[\[{]/.test(value)) {
      try { visit(JSON.parse(value)) } catch { /* 场景中还保留旧对象字面量配置。 */ }
    }
  }
  for (const [manifest, count, key] of manifests) {
    const data = JSON.parse(readFileSync(new URL('config/' + manifest + '.json', root), 'utf8'))
    assert.equal(data.reduce((sum, group) => sum + group[key].length, 0), count, manifest)
    visit(data)
  }
  assert.deepEqual([...missing], [])
})
