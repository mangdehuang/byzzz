import { literal } from './schema.js'

const child = (node, name) => node.findOne('.' + name)
const numericFields = new Set(['x', 'y', 'width', 'height', 'rotation', 'scaleX', 'scaleY', 'fontSize', 'padding',
  'strokeWidth', 'cornerRadius', 'lineHeight', 'rowNum', 'colNum', 'cellWidth', 'cellHeight'])

// 新增和编辑共用属性应用入口，关联子图形与布局一起更新。
export function setNodeProperty(group, field, value) {
  const key = field.attrCode
  if (numericFields.has(key) && value !== 'auto') {
    value = Number(value)
    if (!Number.isFinite(value)) throw new Error('请输入有效数值')
  }
  if (group.getAttr('moduleType') === 'BASELINE' && key === 'strokeWidth' && value < 2) {
    throw new Error('线段粗细不能小于2')
  }
  if (key === 'dash' && typeof value === 'string') {
    value = literal(value)
    if (!Array.isArray(value) || !value.every(Number.isFinite)) throw new Error('请输入有效的虚线数组')
  }
  const where = field.attrWhere || 'this'
  const nodes = where === 'this' ? [group] : where.split(',').map(name => child(group, name.trim())).filter(Boolean)
  for (const node of nodes) {
    node.setAttr(key, value)
    if (key === 'stroke' && node.getAttr('isStrockColorTofill') === true) node.setAttr('fill', value)
  }
  const type = group.getAttr('moduleType')
  if (key === 'widthControl') {
    const textNodes = type === 'TextLableValue' ? [child(group, 'description'), child(group, 'complexTextValue')]
      : [child(group, type === 'lableText' ? 'description' : 'complexTextValue')]
    for (const text of textNodes.filter(Boolean)) text.width(String(value) === '0' ? 'auto' : text.width() + 0.1)
    reflowNode(group)
  }
  if (type === 'FLOWLINE' && key === 'strokeWidth') {
    child(group, 'backgroundLine')?.strokeWidth(value)
    child(group, 'dynamicLine')?.setAttrs({ strokeWidth: value / 5 * 4, dash: [value, value * 2] })
  }
  if (type === 'CURRENTDATE' && key === 'dateFormat') return
  if (['text', 'fontSize', 'fontFamily', 'fontStyle', 'padding', 'width', 'lineHeight', 'currentSelect'].includes(key)) reflowNode(group)
  if (type === 'BASETABLE' && ['rowNum', 'colNum', 'cellWidth', 'cellHeight'].includes(key)) tableLayout(group)
}

// 改动文字和字体后重算边框，保留编辑器中的占位文字及用户默认值。
export function reflowNode(group) {
  const type = group.getAttr('moduleType')
  if (type === 'TextLableValue') {
    const description = child(group, 'description')
    const labelBorder = child(group, 'descriptionRect')
    const value = child(group, 'complexTextValue')
    const unit = child(group, 'unit')
    const border = child(group, 'rectValue')
    if (!description || !value) return
    labelBorder?.size({ width: description.width(), height: description.height() })
    value.position({ x: description.x() + description.width(), y: description.y() })
    if (unit) unit.position({ x: value.x() + value.width() - unit.padding() - value.padding(), y: value.y() })
    border?.setAttrs({ x: value.x(), y: value.y(), height: value.height(),
      width: value.width() + (unit ? unit.width() - unit.padding() - value.padding() : 0) })
  } else if (type === 'VALUE') {
    const value = child(group, 'complexTextValue')
    const unit = child(group, 'unit')
    if (!value) return
    if (unit) unit.position({ x: value.x() + value.width() - unit.padding() - value.padding(), y: value.y() })
    child(group, 'text_border')?.size({ width: value.width() + (unit ? unit.width() - unit.padding() - value.padding() : 0), height: value.height() })
  } else if (type === 'lableText' || type === 'STATUSVALUE') {
    const value = child(group, type === 'lableText' ? 'description' : 'complexTextValue')
    if (value) child(group, 'text_border')?.size({ width: value.width(), height: value.height() })
  } else if (type === 'INPUT_FORM') {
    const value = child(group, 'input_value')
    if (value) child(group, 'input_border')?.height(value.height())
  } else if (type.startsWith('BUTTON')) {
    const text = child(group, 'buttonText')
    if (text) child(group, 'buttonRect')?.setAttrs({ width: text.width(), height: text.height(), fillLinearGradientEndPoint: { x: 0, y: text.height() } })
  } else if (type === 'SwitchGear') {
    const text = child(group, 'description')
    const selected = literal(group.getAttr('currentSelect'))
    if (selected && text) text.text(selected.name)
    const rect = child(group, 'descriptionRect')
    const arrow = child(group, 'arrowText')
    if (!text || !rect || !arrow) return
    rect.size({ width: text.width(), height: text.height() })
    arrow.position({ x: text.x() + text.width(), y: text.y() })
    child(group, 'rectArrow')?.setAttrs({ x: arrow.x(), y: arrow.y(), width: arrow.width(), height: arrow.height() })
  }
}

// 表格沿相反方向串接行列线，与原图元的折线路径一致。
function tableLayout(group) {
  const rows = Math.max(1, Number(group.getAttr('rowNum')) || 1)
  const columns = Math.max(1, Number(group.getAttr('colNum')) || 1)
  const width = columns * Number(group.getAttr('cellWidth'))
  const height = rows * Number(group.getAttr('cellHeight'))
  const horizontal = []
  const vertical = []
  for (let index = 0; index <= rows; index++) {
    const y = index * Number(group.getAttr('cellHeight'))
    horizontal.push(...(index % 2 ? [width, y, 0, y] : [0, y, width, y]))
  }
  for (let index = 0; index <= columns; index++) {
    const x = index * Number(group.getAttr('cellWidth'))
    vertical.push(...(index % 2 ? [x, height, x, 0] : [x, 0, x, height]))
  }
  child(group, 'line1')?.points(horizontal)
  child(group, 'line2')?.points(vertical)
  child(group, 'rectBackground')?.size({ width, height })
  child(group, 'rectBorder')?.size({ width, height })
}
