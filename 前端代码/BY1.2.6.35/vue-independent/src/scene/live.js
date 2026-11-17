import { asRows } from './schema.js'
import { paintImage } from './images.js'
import { calculate } from './formulas.js'
import { FormulaExecutor } from './formula-executor.js'
import { PathAnimations } from './path-animation.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const number = value => value == null || value === '' || value === '---' ? NaN : Number(value)
const child = (group, name) => group.findOne('.' + name)
const datePart = (value, length = 2) => String(value).padStart(length, '0')

export function dateText(format, date = new Date()) {
  const fields = {
    YYYY: date.getFullYear(), YY: date.getFullYear() % 100, mm: datePart(date.getMonth() + 1),
    dd: datePart(date.getDate()), HH: datePart(date.getHours()), MM: datePart(date.getMinutes()),
    SS: datePart(date.getSeconds()), SSS: datePart(date.getMilliseconds(), 3),
    WWW: '星期' + '日一二三四五六'[date.getDay()], WW: '周' + '日一二三四五六'[date.getDay()],
  }
  return String(format || 'YYYY-mm-dd HH:MM:SS').replace(/YYYY|WWW|SSS|WW|YY|mm|dd|HH|MM|SS/g, part => fields[part])
}

function rangeMatches(rule, value) {
  if (value == null || value === '---') return false
  if (rule.status != null && rule.status !== '') return String(rule.status) === String(value)
  const min = number(rule.min)
  const max = number(rule.max)
  if (Number.isNaN(min) && Number.isNaN(max)) return false
  return !Number.isNaN(number(value)) && (Number.isNaN(min) || number(value) >= min) &&
    (Number.isNaN(max) || number(value) <= max)
}

export function matching(rules, input, data) {
  return asRows(rules).find(row => {
    const key = row.devicecode || row.key || row.where?.devicecode
    const value = key ? data[key] : input
    return rangeMatches(row.where ? { ...row, ...row.where } : row, value)
  })
}

export function pointValues(node, data) {
  const keys = asRows(node.getAttr('dataKey'))
  // 保留旧画面只有一个输入值时的自动匹配；多个值时仍要求明确绑定。
  if (keys.length === 1 && !keys[0].key && Object.keys(data).length === 1) {
    const [key, value] = Object.entries(data)[0]
    return [{ key, name: key, value }]
  }
  return keys.filter(entry => entry.key && Object.hasOwn(data, entry.key))
    .map(entry => ({ ...entry, value: data[entry.key] }))
}

function formatValue(attrs, value) {
  const zoom = asRows(attrs.valueZoomConfig)[0]
  if (!zoom || Number.isNaN(number(value))) return value
  const scale = number(zoom.zoomSize)
  const digits = number(zoom.decimalDigits)
  // 原版使用十进制乘法及 Math.round，避免 1.005 这类值的二进制舍入差异。
  const factor = Number.isFinite(scale) ? scale : 1
  const decimals = item => (String(item).split('.')[1] || '').length
  const result = Number(String(value).replace('.', '')) * Number(String(factor).replace('.', '')) /
    10 ** (decimals(value) + decimals(factor))
  return Number.isInteger(digits) && digits >= 0 && digits <= 12
    ? (Math.round(result * 10 ** digits) / 10 ** digits).toFixed(digits) : result
}

// 在新引擎中复现旧图元的属性变化；未命中规则时保留原显示。
export function paintValue(node, value, data, inputs) {
  const attrs = node.attrs
  const method = attrs.methodCall || ''
  const rules = asRows(attrs.where)
  const formatted = formatValue(attrs, value === '---' ? attrs.defaultValue : value)
  const rule = matching(rules, /^set(TValue|TextValue)/.test(method) ? formatted : value, data)
  if (/^set(TValue|TextValue|StatusValue)/.test(method)) {
    const text = child(node, 'complexTextValue')
    if (text) {
      const status = /^setStatusValue/.test(method)
      if (!status || rule) text.text(String(status ? rule.description ?? '' : formatted ?? ''))
      if (rule?.color !== undefined) text.fill(rule.color)
      const border = child(node, 'text_border') || child(node, 'rectValue')
      if (status && rule?.fill !== undefined) border?.fill(rule.fill)
      const unit = child(node, 'unit')
      if (unit) unit.x(text.x() + text.width() - unit.padding() - text.padding())
      if (border) {
        border.width(text.width() + (unit ? unit.width() - unit.padding() - text.padding() : 0))
        if (status) border.height(text.height())
      }
    }
  } else if (/setPoolValue/.test(method)) {
    const rect = child(node, 'pool_background')
    const water = child(node, 'pool_water')
    if (rect && water && Number.isFinite(number(value))) {
      const height = rect.height() * clamp(number(value) / (number(attrs.poolHight) || 1), 0, 1)
      water.setAttrs({ y: rect.y() + rect.height() - height, height })
    }
  } else if (/SwitchValue|ImageStatusValue/.test(method)) {
    const image = node.findOne('Image')
    if (rule?.icon && image && image.currentSource !== rule.icon) {
      image.currentSource = rule.icon
      paintImage(image, rule.icon)
    }
  } else if (/SwitchGearValue/.test(method)) {
    const gear = asRows(attrs.gearConfig).find(row => String(row.value) === String(value)) || { name: '请选择', value: '', cmd: '' }
    node.setAttr('currentSelect', { name: gear.name, value: gear.value, cmd: gear.cmd })
    child(node, 'description')?.text(gear.name)
    const rect = child(node, 'descriptionRect')
    const arrow = child(node, 'arrowText')
    const border = child(node, 'rectArrow')
    if (rect && arrow && border) {
      rect.width(rect.width())
      rect.height(rect.height())
      arrow.x(rect.x() + rect.width())
      arrow.y(rect.y())
      border.setAttrs({ x: rect.x() + rect.width(), y: rect.y(), width: arrow.width(), height: arrow.height() })
    }
  } else if (/setStatusLight/.test(method) && rule?.color) {
    child(node, 'Light')?.fillRadialGradientColorStops([0, '#f1f1f1', 0.7, rule.color, 1, '#f1f1f1'])
  } else if (/setStatusElectric/.test(method)) {
    const state = matching(attrs.OnOffState ?? rules, value, data)
    if (state) {
      for (const shape of node.getChildren()) {
        shape.stroke(state.color)
        if (shape.getAttr('isStrockColorTofill') === true) shape.fill(state.color)
      }
      const coordinates = attrs.onoffXY?.[state.textState === '合' ? 'on' : state.textState === '开' ? 'off' : '']
      if (coordinates) node.find('.khys').forEach(shape => shape.points(coordinates))
    }
  } else if (/setStatusLine/.test(method) && rule?.color) {
    child(node, 'line1')?.stroke(rule.color)
  } else if (method === 'setShapeAttr' && rule?.color) {
    node.getChildren().forEach(shape => shape.fill(rule.color))
  } else if (method === 'setSprinkingAngle') {
    const angle = inputs.find(item => item.description === '角度')?.value ?? value
    const state = inputs.find(item => item.description === '状态')?.value
    const line = child(node, 'device_body_line')
    if (line && Number.isFinite(number(angle))) line.rotation(Number(angle))
    const color = matching(rules, state, data)?.color
    if (color) line?.stroke(color)
  }
}

// 原版预览会先应用配置的默认文字，不能把编辑器的 ## 占位符带入监控。
export function initializeDisplay(node) {
  const type = node.getAttr('moduleType')
  if (!['VALUE', 'TextLableValue', 'STATUSVALUE'].includes(type)) return
  const text = child(node, 'complexTextValue')
  if (!text) return
  text.text(String(node.getAttr('defaultValue') ?? ''))
  const unit = child(node, 'unit')
  const description = child(node, 'description')
  const descriptionBorder = child(node, 'descriptionRect')
  if (type === 'TextLableValue' && description && descriptionBorder) {
    descriptionBorder.width(description.width())
    descriptionBorder.height(description.height())
    text.x(description.x() + description.width())
    text.y(description.y())
  }
  const border = child(node, type === 'TextLableValue' ? 'rectValue' : 'text_border')
  if (unit) {
    unit.x(text.x() + text.width() - unit.padding() - text.padding())
    unit.y(text.y())
  } else if (type !== 'STATUSVALUE') {
    text.text(text.text() + (node.getAttr('unit') || ''))
  }
  if (border) {
    border.width(text.width() + (unit ? unit.width() - unit.padding() - text.padding() : 0))
    if (type === 'STATUSVALUE') border.height(text.height())
    if (type === 'TextLableValue') border.setAttrs({ x: text.x(), y: text.y() })
  }
}

export class SceneData {
  constructor(engine, updated, condition) {
    this.engine = engine
    this.updated = updated
    this.condition = condition
    this.values = Object.create(null)
    this.animation = new Map()
    this.paths = new PathAnimations(engine)
    this.lastCondition = ''
    this.formulaErrors = new Set()
    this.lastTick = 0
    this.formulaVersion = 0
    this.tick = this.tick.bind(this)
    this.frame = requestAnimationFrame(this.tick)
  }

  update(packet) {
    if (!packet || Array.isArray(packet) || typeof packet !== 'object') return
    for (const [key, value] of Object.entries(packet)) this.values[key] = value
    const variables = asRows(this.engine.stage.getAttr('dummyVarList'))
    const version = ++this.formulaVersion
    for (const item of variables) {
      try {
        const value = calculate(item.script, this.values)
        if (value !== undefined) this.values[item.id] = value
        this.formulaErrors.delete(item.id)
      } catch {
        this.formulaErrors.add(item.id)
        delete this.values[item.id]
      }
    }
    if (this.formulaErrors.size && typeof Worker !== 'undefined') {
      this.executor ||= new FormulaExecutor()
      // 按原顺序计算整张变量表，后续变量可引用前面脚本的结果。
      this.executor.evaluate(variables, this.values).then(({ results, errors }) => {
        if (version !== this.formulaVersion) return
        this.formulaErrors = new Set(errors)
        for (const id of errors) delete this.values[id]
        Object.assign(this.values, results)
        this.paint()
      }).catch(() => {
        if (version !== this.formulaVersion) return
        this.formulaErrors = new Set(variables.map(item => item.id))
        for (const item of variables) delete this.values[item.id]
        this.paint()
      })
      return
    }
    this.paint()
  }

  // 同步公式和异步兼容脚本共用一次渲染，避免重复记录图表采样。
  paint() {
    const info = this.engine.stage.getAttr('conditionInfo')
    const rule = String(info?.conditionType) === '1' && matching(info.conditionWhere, undefined, this.values)
    const key = rule ? JSON.stringify(rule) : ''
    if (rule && key !== this.lastCondition) this.condition(rule)
    this.lastCondition = key

    for (const node of this.engine.groups()) {
      const attrs = node.attrs
      const inputs = pointValues(node, this.values)
      const value = inputs.at(-1)?.value
      const hide = matching(attrs.hideWhere, value, this.values)
      const previous = this.animation.get(node)
      let baseVisible = previous?.visible ?? node.visible()
      // 原版在隐藏条件所需点位尚未到达时保留显示状态。
      if (asRows(attrs.hideWhere).some(row => row.devicecode && Object.hasOwn(this.values, row.devicecode))) {
        baseVisible = !hide
        node.visible(baseVisible)
      }
      const flash = matching(attrs.sparklingWhere, value, this.values)
      const flowRule = matching(attrs.whereNew, value, this.values)
      const rotation = matching(attrs.rotateWhereNew || attrs.rotateWhere, value, this.values)
      const direction = String(flowRule?.direction ?? rotation?.directionRotation ?? attrs.defalutAnima)
      // 原版每帧流动 1/3px、整体旋转 5/10 度；按 60Hz 换算以适配不同刷新率。
      const rotating = attrs.moduleType === 'SVG_Rotating'
      const speeds = rotating ? { 1: 0.3, 11: 0.6, 2: -0.3, 22: -0.6 }
        : { 1: 0.06, 11: 0.18, 2: -0.06, 22: -0.18 }
      if (flash || speeds[direction]) {
        this.animation.set(node, { flash, speed: speeds[direction] || 0, visible: baseVisible, started: previous?.started })
      } else if (this.animation.has(node)) {
        node.visible(baseVisible)
        this.animation.delete(node)
      }
      if (inputs.length) paintValue(node, value, this.values, inputs)
    }
    this.paths.update(this.values)
    this.engine.stage.batchDraw()
    this.updated(this.values, { sample: true })
  }

  tick(now) {
    const elapsed = this.lastTick ? Math.min(now - this.lastTick, 100) : 0
    this.lastTick = now
    let dirty = this.paths.tick(elapsed)
    if (Math.floor(now / 1000) !== this.second) {
      this.second = Math.floor(now / 1000)
      for (const node of this.engine.groups()) {
        if (node.getAttr('moduleType') !== 'CURRENTDATE') continue
        child(node, 'complexTextValue')?.text(dateText(node.getAttr('dateFormat')))
        dirty = true
      }
    }
    for (const [node, effect] of this.animation) {
      if (effect.flash) {
        // 原版为每 200ms 显示/隐藏，HTML 覆盖层也必须收到同一可见状态。
        effect.started ??= now
        const visible = effect.visible && Math.floor((now - effect.started) / 200) % 2 === 0
        if (visible !== node.visible()) {
          node.visible(visible)
        }
      }
      if (effect.speed) {
        const line = child(node, 'dynamicLine')
        if (line) line.dashOffset(((line.dashOffset() || 0) - elapsed * effect.speed) % 2000)
        else if (node.getAttr('moduleType') === 'SVG_Rotating') node.rotate(elapsed * effect.speed)
      }
      dirty = true
    }
    if (dirty) {
      this.engine.stage.batchDraw()
      // 路径、旋转与时钟只更新覆盖层位置，不增加图表采样。
      this.updated(this.values, { sample: false })
    }
    this.frame = requestAnimationFrame(this.tick)
  }

  destroy() {
    this.formulaVersion += 1
    this.executor?.destroy()
    cancelAnimationFrame(this.frame)
    this.animation.clear()
  }
}
