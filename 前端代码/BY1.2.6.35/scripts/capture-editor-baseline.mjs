import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { SceneDouble } from '../vue-independent/tests/helpers/scene-double.mjs'

// 显式对照工具，不参与默认构建；快照使新代码的日常测试不依赖旧运行时。
const root = new URL('../', import.meta.url)
const source = readFileSync(new URL('byzt/js/stageOperation.js', root), 'utf8')
const context = vm.createContext({})
vm.runInContext('window = this', context)
vm.runInContext(source, context)
const legacy = vm.runInContext('new StageOperation()', context)
legacy.layer = { draw() {} }
legacy.addLineEdit = () => {}
legacy.addFlowLineEdit = () => {}
const catalog = JSON.parse(readFileSync(new URL('vue-independent/public/byzt/config/module_config_base.json', root)))
const cases = []
for (const category of catalog) for (const item of category.moduleItem) {
  const model = item.moduleJson
  for (const section of model.attrs.moduleAttr || []) for (const field of section.attrGroupContent || [section]) {
    const targets = field.attrWhere === 'this' ? [model] : new SceneDouble(model).find('.' + (field.attrWhere || '').split(',')[0])
    if (!targets.length) continue
    const fields = field.attrType === 'fontNew' ? [{ ...field, attrCode: 'fontSize' }] : [field]
    for (const definition of fields) {
      const key = definition.attrCode
      if (!['text','fontSize','padding','strokeWidth','cornerRadius','rowNum','colNum','cellWidth','cellHeight'].includes(key)) continue
      const value = key === 'text' ? '新增编辑一致性检查' : key === 'rowNum' || key === 'colNum' ? 4 : 24
      const node = new SceneDouble(model)
      legacy.setModuleAttr(node, definition.attrWhere, key, value, undefined, definition.attrType)
      cases.push({ name: `${cases.length + 1}:${model.attrs.moduleType}:${definition.attrWhere}:${key}`, model,
        field: definition, value, expected: node.snapshot() })
    }
  }
}
writeFileSync(new URL('vue-independent/tests/fixtures/legacy-editor.json', root), JSON.stringify({
  source: 'byzt/js/stageOperation.js', sha256: createHash('sha256').update(source).digest('hex'),
  scope: 'property application and dependent node attributes; not a pixel acceptance', cases,
}))
console.log('Captured original editor cases:', cases.length)
