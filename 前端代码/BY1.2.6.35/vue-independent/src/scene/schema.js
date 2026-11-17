import JSON5 from 'json5'

const knownNodes = new Set([
  'Stage', 'Layer', 'FastLayer', 'Group', 'Line', 'Rect', 'Image', 'Text', 'Circle', 'Ellipse',
  'Wedge', 'Star', 'Ring', 'Arc', 'RegularPolygon', 'Arrow', 'Path', 'Shape', 'TextPath', 'Label', 'Tag',
])
const transientNodes = new Set(['transformer', 'selectionRectangle', 'myShapeBackgroundImage'])

export function literal(value, fallback = null) {
  if (value === '' || value == null) return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON5.parse(value.trim().replace(/^\(([\s\S]*)\)$/, '$1'))
  } catch {
    return fallback
  }
}

export function asRows(value) {
  const result = literal(value, [])
  return Array.isArray(result) ? result : result && typeof result === 'object' ? [result] : []
}

export function uid() {
  return crypto.randomUUID().replaceAll('-', '')
}

export function assetURL(value) {
  if (!value || typeof value !== 'string') return ''
  if (/^config\//.test(value)) return '/byzt/' + value
  if (/^(data:image\/|blob:|https?:\/\/|\/)/i.test(value) && !value.startsWith('//')) return value
  return ''
}

export function defaultScene(config) {
  return {
    className: 'Stage',
    attrs: {
      id: uid(), width: 1024, height: 768, IsBackgroundFull: '1', isForcedRotation: '1',
      isStageMove: '1', isStageCache: '0', dataKeyArray: {}, dummyVarList: [],
      conditionInfo: { conditionType: '0', conditionWhere: '' },
      webSocket: { webSocketIsOn: 1, websocketUrl: config.webSocketUrl },
      mqtt: { mqttIsOn: 0, mqttUrl: config.mqttUrl, mqttUser: config.mqttUser, mqttPawss: config.mqttPawss, Topics: '' },
      controlType: { type: 1, controlTopics: '' },
    },
    children: [
      { className: 'Layer', attrs: { name: 'layer_grid' }, children: [
        { className: 'Rect', attrs: { name: 'layer_background', width: 1024, height: 768, fill: 'rgba(237,237,237,1)', listening: false } },
      ] },
      { className: 'Layer', attrs: {}, children: [] },
      { className: 'Layer', attrs: { name: 'layer_three' }, children: [] },
    ],
  }
}

export function sanitizeNode(node) {
  if (!node || !knownNodes.has(node.className) || node.attrs?.byztEditorOnly || transientNodes.has(node.attrs?.name) || String(node.attrs?.name || '').includes('edit_anchor')) return null
  const clean = { className: node.className, attrs: { ...node.attrs } }
  if (Array.isArray(node.children)) clean.children = node.children.map(sanitizeNode).filter(Boolean)
  return clean
}

// 读取现有画面的字段与节点结构，补齐历史文件可能缺失的配置。
export function loadScene(value, config) {
  const source = literal(value)
  if (!source || source.className !== 'Stage') throw new Error('画面 JSON 格式无效')
  const defaults = defaultScene(config)
  const scene = sanitizeNode(source)
  scene.attrs = { ...defaults.attrs, ...scene.attrs }
  for (const key of ['webSocket', 'mqtt', 'controlType', 'conditionInfo']) {
    scene.attrs[key] = { ...defaults.attrs[key], ...literal(scene.attrs[key], {}) }
  }
  const layers = scene.children || []
  const backdrop = layers.find(layer => layer.attrs.name === 'layer_grid') || defaults.children[0]
  const top = layers.find(layer => layer.attrs.name === 'layer_three') || defaults.children[2]
  const content = layers.filter(layer => layer !== backdrop && layer !== top)
  scene.children = [backdrop, ...(content.length ? content : [defaults.children[1]]), top]
  return scene
}

export function moduleGroup(node) {
  let current = node
  while (current && current.getClassName() !== 'Layer') {
    if (current.getAttr('moduleType') || current.hasName('jyzt_module_group')) return current
    current = current.getParent()
  }
  return null
}

// 数据点可能来自变量表、动画条件、控制值和图表数据系列。
export function dataKeys(document) {
  const keys = new Set()
  function visit(value, property) {
    if (Array.isArray(value)) value.forEach(item => visit(item, property))
    else if (value && typeof value === 'object') {
      for (const [name, child] of Object.entries(value)) {
        if (['devicecode', 'hardware_code', 'dataPointId'].includes(name) ||
          (name === 'key' && /dataKey|sendKey|variate|field|condition/i.test(property))) {
          if (typeof child === 'string' && child && !child.startsWith('DVAR')) keys.add(child)
        } else if (!['moduleAttr', 'stagebase64', 'imageURL'].includes(name)) {
          visit(child, name)
        }
      }
    } else if (typeof value === 'string' && /^[\[{]/.test(value.trim()) && /where|key|condition|zoom|gear|field|rotate/i.test(property)) {
      visit(literal(value), property)
    }
  }
  visit(document, '')
  // 虚拟变量脚本中的 {{point}} 也必须订阅，否则公式拿不到实时值。
  for (const variable of asRows(document?.attrs?.dummyVarList)) {
    for (const match of String(variable.script || '').matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
      if (match[1] && !match[1].startsWith('DVAR')) keys.add(match[1].trim())
    }
  }
  return [...keys]
}
