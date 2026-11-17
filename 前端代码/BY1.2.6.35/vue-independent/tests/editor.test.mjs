import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setNodeProperty } from '../src/scene/properties.js'
import { SceneDouble } from './helpers/scene-double.mjs'

const baseline = JSON.parse(readFileSync(new URL('./fixtures/legacy-editor.json', import.meta.url)))
for (const entry of baseline.cases) test('original editor property ' + entry.name, () => {
  const node = new SceneDouble(entry.model)
  setNodeProperty(node, entry.field, entry.value)
  assert.deepEqual(node.snapshot(), entry.expected)
})

test('line validation rejects invalid widths before changing the node', () => {
  const node = new SceneDouble({ className: 'Group', attrs: { moduleType: 'BASELINE' }, children: [
    { className: 'Line', attrs: { name: 'line1', strokeWidth: 4 } },
  ] })
  assert.throws(() => setNodeProperty(node, { attrCode: 'strokeWidth', attrWhere: 'line1' }, 1), /不能小于2/)
  assert.equal(node.findOne('.line1').strokeWidth(), 4)
  assert.throws(() => setNodeProperty(node, { attrCode: 'x', attrWhere: 'this' }, 'wrong'), /有效数值/)
})
