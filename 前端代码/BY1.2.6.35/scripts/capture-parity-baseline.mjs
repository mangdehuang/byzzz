import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { SceneDouble } from '../vue-independent/tests/helpers/scene-double.mjs'

// 仅在显式对照时读取历史源码。生成的属性快照可随新前端独立测试，不包含旧引擎。
const root = new URL('../', import.meta.url)
const animation = readFileSync(new URL('byzt/js/moduleAnimation.js', root), 'utf8')
const tools = readFileSync(new URL('byzt/js/common/tool.js', root), 'utf8')
const context = vm.createContext({ jQuery: { fn: {} }, document: { location: { href: 'http://localhost/' } } })
vm.runInContext('window = this', context)
vm.runInContext(tools, context)
vm.runInContext(animation, context)
const legacy = vm.runInContext('new ModuleAnimation()', context)
const methods = new Set(['setTValueNew', 'setTextValueNew', 'setStatusValueNew2', 'setStatusLightNew', 'setStatusLineNew', 'setStatusElectricNew', 'setShapeAttr', 'setSwitchGearValueNew'])
const catalog = JSON.parse(readFileSync(new URL('vue-independent/public/byzt/config/module_config_base.json', root)))
const cases = []
for (const group of catalog) {
  for (const item of group.moduleItem) {
    const model = typeof item.moduleJson === 'string' ? JSON.parse(item.moduleJson) : item.moduleJson
    const method = model.attrs.methodCall
    if (!methods.has(method)) continue
    const variants = [model]
    if (['setTValueNew', 'setTextValueNew'].includes(method)) {
      const adjusted = structuredClone(model)
      adjusted.attrs.valueZoomConfig = [{ zoomSize: '0.1', decimalDigits: '2' }]
      adjusted.attrs.where = [{ min: '0', max: '1', color: '#aa0011' }, { min: '1.01', max: '100', color: '#1133ff' }]
      variants.push(adjusted)
    }
    if (method === 'setStatusValueNew2') {
      const adjusted = structuredClone(model)
      adjusted.attrs.where = [{ min: '0', max: '0', description: '', color: '#aa0011', fill: '#00ff00' },
        { min: '1', max: '100', description: '运行', color: '#1133ff', fill: '#ffffff' }]
      variants.push(adjusted)
    }
    for (const variant of variants) for (const value of [-1, 0, 1, 12.345, 30, 100, '---']) {
      const node = new SceneDouble(variant)
      legacy[method](node, { point: value })
      cases.push({ name: `${cases.length + 1}:${model.attrs.moduleType}:${value}`, model: variant, value, expected: node.snapshot() })
    }
  }
}
const directory = new URL('vue-independent/tests/fixtures/', root)
mkdirSync(directory, { recursive: true })
const fixture = { source: 'byzt/js/moduleAnimation.js', sha256: createHash('sha256').update(animation).digest('hex'), scope: 'node attributes only; no pixel or external-service acceptance', cases }
writeFileSync(new URL('legacy-animation.json', directory), JSON.stringify(fixture))
console.log(`Captured ${cases.length} original animation cases`)
