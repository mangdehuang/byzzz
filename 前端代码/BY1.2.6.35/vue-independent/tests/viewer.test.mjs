import assert from 'node:assert/strict'
import test from 'node:test'
import Konva from 'konva'
import { PathAnimations } from '../src/scene/path-animation.js'
import { basicInfo, clickDialog, infoValue } from '../src/viewer/info.js'
import { openPreview } from '../src/viewer/draft.js'
import { activateNode } from '../src/viewer/behaviors.js'

// 使用实际 Konva 变换验证折线、父节点缩放及图元原有偏移。
function scene(overrides = {}, follower = false) {
  const root = new Konva.Group()
  const path = new Konva.Group({ id: 'path', sourceId: 'source', x: 10, y: 20 })
  path.add(new Konva.Line({ name: 'trackHLine', points: [0, 0, 100, 0, 100, 100] }))
  const source = new Konva.Group({ id: 'source', x: 25, y: 35, moduleType: 'VALUE',
    pathAminMethodCall: 'pathAminModule', Hmove: '1', trackHid: 'path',
    HdataKey: [{ key: 'distance' }], Hscope: { min: -100, max: 100 },
    HinitPosition: -100, seppd: 100, HpathHide: '1', ...overrides })
  root.add(path, source)
  const follow = new Konva.Group({ id: 'follow', x: 45, y: 55, moduleType: 'VALUE',
    pathAminMethodCall: 'pathAminModule', followPath: 'path' })
  if (follower) root.add(follow)
  const runtime = new PathAnimations({ groups: () => root.getChildren() })
  return { root, path, source, follow, runtime }
}

test('path follows every segment at configured speed and returns without cutting corners', () => {
  const { runtime, source, path } = scene()
  assert.equal(path.visible(), false)
  runtime.update({ distance: 100 })
  assert.deepEqual(source.position(), { x: 25, y: 35 })
  runtime.tick(500)
  assert.deepEqual(source.position(), { x: 75, y: 35 })
  runtime.tick(1000)
  assert.deepEqual(source.position(), { x: 125, y: 85 })
  runtime.update({ distance: -100 })
  runtime.tick(1000)
  assert.deepEqual(source.position(), { x: 75, y: 35 })
  runtime.tick(500)
  assert.deepEqual(source.position(), { x: 25, y: 35 })
  assert.equal(runtime.tick(1000), false)
})

test('path initial position and real zero are independent of missing and out of range data', () => {
  const { runtime, source } = scene({ HinitPosition: 0 })
  assert.deepEqual(source.position(), { x: 125, y: 35 })
  for (const distance of [undefined, null, '', '---', 101, -101, 'wrong']) {
    runtime.update({ distance })
    runtime.tick(1000)
    assert.deepEqual(source.position(), { x: 125, y: 35 })
  }
  runtime.update({ distance: -100 })
  runtime.tick(1000)
  runtime.update({ distance: 0 })
  runtime.tick(1000)
  assert.deepEqual(source.position(), { x: 125, y: 35 })
})

test('following nodes inherit path owner settings and retain their own offset', () => {
  const { runtime, source, follow } = scene({}, true)
  runtime.update({ distance: 100 })
  runtime.tick(2000)
  assert.deepEqual(source.position(), { x: 125, y: 135 })
  assert.deepEqual(follow.position(), { x: 145, y: 155 })
})

test('disabled path animation never changes node position or path visibility', () => {
  const { runtime, source, path } = scene({ Hmove: '0' })
  runtime.update({ distance: 100 })
  runtime.tick(1000)
  assert.equal(path.visible(), true)
  assert.deepEqual(source.position(), { x: 25, y: 35 })
})

test('path without speed keeps compatible immediate movement', () => {
  const { runtime, source } = scene({ seppd: '' })
  runtime.update({ distance: 100 })
  assert.deepEqual(source.position(), { x: 125, y: 135 })
})

test('path resolves scaled and rotated coordinates without losing original node offset', () => {
  const { root, path, source } = scene({ seppd: 0 })
  path.rotation(90)
  root.scale({ x: 2, y: 2 })
  const origin = source.absolutePosition()
  const runtime = new PathAnimations({ groups: () => root.getChildren() })
  runtime.update({ distance: 100 })
  const result = source.absolutePosition()
  assert.ok(Math.abs(result.x - (origin.x - 200)) < 0.001)
  assert.ok(Math.abs(result.y - (origin.y + 200)) < 0.001)
})

test('hover and click information modes remain distinct', () => {
  const info = { showType: '2', showContent: [{ title: '功率', type: '2' }] }
  const node = { getAttr: () => JSON.stringify(info) }
  assert.equal(basicInfo(node, '1'), null)
  assert.deepEqual(basicInfo(node, '2'), info)
})

test('information preserves zero and separates missing values from unmatched states', () => {
  assert.equal(infoValue({ type: '2', value: { devicecode: 'p' }, unit: 'kW' }, { p: 0 }), '0kW')
  assert.equal(infoValue({ type: '2', value: { devicecode: 'p' }, unit: 'kW' }, {}), '—')
  const row = { type: '4', value: { key: { devicecode: 's' }, state: [{ value: 0, text: '停止' }] } }
  assert.equal(infoValue(row, { s: 0 }), '停止')
  assert.equal(infoValue(row, { s: 2 }), '状态未匹配')
  assert.equal(infoValue(row, {}), '—')
})

test('click popup retains old point key URL convention and refuses script URLs', () => {
  globalThis.location = { origin: 'http://localhost' }
  assert.deepEqual(clickDialog({ clickInfo: { clickType: '1', urlContent: '/detail?key=', contentWidth: 420, contentHeight: 300 },
    urlParam: "[{key:'p 1'},{key:'p2'}]" }), { url: 'http://localhost/detail?key=p%201@p2@', width: 420, height: 300 })
  assert.equal(clickDialog({ clickInfo: { clickType: '0', urlContent: '/detail' } }), null)
  assert.equal(clickDialog({ clickInfo: { clickType: '1', urlContent: 'javascript:alert(1)' } }), null)
})

test('right button never executes configured single click behavior', () => {
  let count = 0
  activateNode({ attrs: { eventBehaviour: [{ isOpenEvent: '1', eventType: '1', eventBehaviour: {
    behaviourType: '3', behavior_variate: { key: 'p' }, fixedValue: 1,
  } }] } }, { type: 'click', button: 2 }, { send: () => count++ })
  assert.equal(count, 0)
})

test('writable numeric values retain the set-value interaction and default zero', () => {
  const prompts = []
  activateNode({ attrs: { moduleType: 'VALUE', readWriteFlag: '2', dataKey: [{ key: 'setpoint' }], defaultValue: 0 } },
    { type: 'tap' }, { prompt: (...args) => prompts.push(args) })
  assert.deepEqual(prompts, [['setpoint', 0, undefined]])
})

test('double tap executes only the configured double click behavior', () => {
  const sent = []
  activateNode({ attrs: { eventBehaviour: [1, 2].map(type => ({ isOpenEvent: '1', eventType: String(type),
    eventBehaviour: { behaviourType: '3', behavior_variate: { key: 'p' }, fixedValue: type } })) } },
  { type: 'dbltap' }, { send: (...args) => sent.push(args) })
  assert.equal(sent.length, 1)
  assert.equal(sent[0][1], 2)
})

test('invalid path ranges do not hide paths or mutate the scene', () => {
  for (const Hscope of [{ min: 0, max: Infinity }, { min: 10, max: 10 }, { min: '', max: 100 }]) {
    const { source, path, runtime } = scene({ Hscope })
    runtime.update({ distance: 100 })
    runtime.tick(1000)
    assert.equal(path.visible(), true)
    assert.deepEqual(source.position(), { x: 25, y: 35 })
  }
})

test('preview passes unsaved JSON and URL context to child and releases parent copy', () => {
  const storage = new Map()
  const api = { setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
  const child = {}
  const result = openPreview('{scene:1}', { key: 'draft1', storage: api,
    href: 'http://localhost/byzt/?id=old&stageId=old&draft=old&project=42', open: raw => {
      const url = new URL(raw)
      assert.equal(url.pathname, '/byzt/preview.html')
      assert.equal(url.searchParams.get('project'), '42')
      assert.equal(url.searchParams.get('draft'), 'draft1')
      assert.equal(url.searchParams.has('id'), false)
      assert.equal(storage.get('draft1'), '{scene:1}')
      return child
    } })
  assert.equal(result, child)
  assert.equal(storage.size, 0)
})

test('blocked preview popup reports failure and removes its draft', () => {
  const removed = []
  assert.throws(() => openPreview('{}', { key: 'blocked', href: 'http://localhost/',
    storage: { setItem() {}, removeItem: key => removed.push(key) }, open: () => null }))
  assert.deepEqual(removed, ['blocked'])
})
