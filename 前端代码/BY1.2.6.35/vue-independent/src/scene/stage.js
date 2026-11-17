import Konva from 'konva'
import { initializeDisplay } from './live.js'
import { assetURL, dataKeys, defaultScene, loadScene, moduleGroup, sanitizeNode, uid } from './schema'
import { hydrateGroup, paintImage } from './images'
import { addLinePoint, editLine } from './line-controls'

const alignment = {
  left: ['x', 'min'], right: ['x', 'max'], top: ['y', 'min'], bottom: ['y', 'max'],
  horizontal: ['x', 'middle'], vertical: ['y', 'middle'],
}

export class SceneStage {
  constructor(container, config, { editing = false, changed = () => {}, activated = () => {}, hovered = () => {} } = {}) {
    this.container = container
    this.config = config
    this.editing = editing
    this.changed = changed
    this.activated = activated
    this.hovered = hovered
    this.history = []
    this.cursor = 0
    this.selected = []
    this.render(defaultScene(config))
    this.resetHistory()
  }

  render(doc) {
    this.assets?.abort()
    this.assets = new AbortController()
    this.stage?.destroy()
    this.stage = Konva.Node.create(doc, this.container)
    const layers = this.stage.getLayers()
    this.backdrop = layers[0]
    this.backdrop.listening(false)
    this.content = layers[1]
    this.editLayer = layers.at(-1)
    this.selected = []
    if (!this.backdrop.findOne('.layer_background')) {
      const fill = new Konva.Rect({ ...defaultScene(this.config).children[0].children[0].attrs })
      fill.size(this.stage.size())
      this.backdrop.add(fill)
      fill.moveToBottom()
    }
    this.backgroundImage(this.backdrop.getAttr('backgroundImageURL'), false)
    this.groups().forEach(node => this.prepareGroup(node))
    this.editing ? this.bindEditorEvents() : this.bindViewerEvents()
    this.stage.batchDraw()
    this.changed(this)
  }

  groups() {
    return this.stage.find('Group').filter(node => Boolean(node.getAttr('moduleType')))
  }

  prepareGroup(node) {
    if (!node.id()) node.id(uid())
    if (!this.editing) {
      node.draggable(false)
      initializeDisplay(node)
      // HTML 输入负责文字与占位，画布只保留用户配置的边框和背景。
      if (node.getAttr('moduleType') === 'INPUT_FORM') node.findOne('.input_value')?.visible(false)
    }
    const type = node.getAttr('moduleType')
    if (this.editing && (/^ECHART_|^HTML_IFRAME|^(LIVE|MONITOR|SPBF|WEATHER)_IMAGES$/.test(type))) {
      let hit = node.findOne('.byzt-widget-hit')
      if (!hit) {
        hit = new Konva.Rect({ name: 'byzt-widget-hit', fill: 'rgba(0,0,0,0.001)', byztEditorOnly: true })
        node.add(hit)
        hit.moveToBottom()
      }
      hit.size({ width: Number(node.getAttr('width')) || 160, height: Number(node.getAttr('height')) || 100 })
    }
    return hydrateGroup(node, { signal: this.assets.signal, animate: !this.editing })
  }

  bindEditorEvents() {
    const transformer = this.transformer = new Konva.Transformer({ padding: 4, ignoreStroke: true, name: 'transformer' })
    this.editLayer.add(transformer)
    const marquee = new Konva.Rect({ name: 'selectionRectangle', fill: '#2487e833', stroke: '#2487e8', visible: false, listening: false })
    this.editLayer.add(marquee)
    let origin
    let marqueeUsed = false
    this.stage.on('mousedown touchstart', event => {
      if (event.target !== this.stage || event.evt.button === 2) return
      origin = this.stage.getPointerPosition()
      marqueeUsed = false
    })
    this.stage.on('mousemove touchmove', () => {
      if (!origin) return
      const current = this.stage.getPointerPosition()
      if (!current || Math.hypot(current.x - origin.x, current.y - origin.y) < 4) return
      marqueeUsed = true
      marquee.setAttrs({
        x: Math.min(origin.x, current.x), y: Math.min(origin.y, current.y),
        width: Math.abs(current.x - origin.x), height: Math.abs(current.y - origin.y), visible: true,
      })
    })
    this.stage.on('mouseup touchend', () => {
      origin = undefined
      if (!marquee.visible()) return
      const bounds = marquee.getClientRect()
      marquee.hide()
      this.select(this.groups().filter(node => node.isVisible() && Konva.Util.haveIntersection(bounds, node.getClientRect())))
    })
    this.stage.on('click tap', event => {
      if (marqueeUsed) { marqueeUsed = false; return }
      const node = moduleGroup(event.target)
      const multiple = event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey
      this.select(multiple && node
        ? this.selected.includes(node) ? this.selected.filter(item => item !== node) : [...this.selected, node]
        : node ? [node] : [])
    })
    this.stage.on('dblclick dbltap', event => {
      const node = moduleGroup(event.target)
      if (node) addLinePoint(this, node, this.stage.getPointerPosition())
    })
    this.stage.on('dragstart', event => {
      const node = moduleGroup(event.target)
      if (node && !this.selected.includes(node)) this.select([node])
      if (node) this.editLayer.find('.byzt-line-handle').forEach(anchor => anchor.destroy())
      this.dragFrom = node?.position()
    })
    this.stage.on('dragend', event => {
      const node = moduleGroup(event.target)
      if (node && this.dragFrom) {
        const dx = node.x() - this.dragFrom.x
        const dy = node.y() - this.dragFrom.y
        this.selected.filter(item => item !== node).forEach(item => item.move({ x: dx, y: dy }))
      }
      this.dragFrom = undefined
      if (node && this.selected.length === 1) editLine(this, node)
      this.commit()
    })
    this.stage.on('transformend', () => this.commit())
    this.stage.on('dragmove transform', () => this.changed(this))
    this.stage.on('contextmenu', event => {
      event.evt.preventDefault()
      const node = moduleGroup(event.target)
      if (node && !this.selected.includes(node)) this.select([node])
      this.activated(node, event.evt)
    })
  }

  bindViewerEvents() {
    this.stage.on('click tap dblclick dbltap contextmenu', event => {
      const node = moduleGroup(event.target)
      // Konva 的 tap/dbltap 需保留事件类型，触摸坐标从 changedTouches 读取。
      const native = event.evt
      const pointer = native.changedTouches?.[0] || native
      this.activated(node, { type: event.type, button: native.button,
        clientX: pointer.clientX ?? 0, clientY: pointer.clientY ?? 0,
        preventDefault: () => native.preventDefault() })
    })
    this.stage.on('mousemove', event => this.hovered(moduleGroup(event.target), event.evt))
    this.stage.on('mouseleave', event => this.hovered(null, event.evt))
  }

  select(nodes) {
    this.selected = nodes
    const handled = this.editing && editLine(this, nodes.length === 1 && nodes[0].draggable() ? nodes[0] : null)
    this.transformer?.nodes(handled ? [] : nodes.filter(node => node.draggable()))
    this.stage.batchDraw()
    this.changed(this)
  }

  insert(model, position) {
    const node = Konva.Node.create(structuredClone(model))
    node.setAttrs({ ...position, id: uid(), draggable: true })
    this.content.add(node)
    this.prepareGroup(node)
    this.select([node])
    this.commit()
    return node
  }

  import(value) {
    this.render(loadScene(value, this.config))
    this.commit()
  }

  resetHistory() {
    this.history = [this.serialize()]
    this.cursor = 0
    this.changed(this)
  }

  commit() {
    const state = this.serialize()
    if (state !== this.history[this.cursor]) {
      this.history.splice(this.cursor + 1)
      this.history.push(state)
      if (this.history.length > 80) this.history.shift()
      this.cursor = this.history.length - 1
    }
    this.stage.batchDraw()
    this.changed(this)
  }

  historyStep(offset) {
    const next = this.cursor + offset
    if (next < 0 || next >= this.history.length) return
    this.cursor = next
    this.render(loadScene(this.history[next], this.config))
  }

  action(name) {
    if (name === 'undo' || name === 'redo') return this.historyStep(name === 'undo' ? -1 : 1)
    if (name === 'all') return this.select(this.groups())
    const selected = [...this.selected]
    if (!selected.length) return
    if (name === 'copy') {
      const copies = selected.map(node => {
        const copy = node.clone({ id: uid(), x: node.x() + 10, y: node.y() + 10 })
        node.getParent().add(copy)
        this.prepareGroup(copy)
        return copy
      })
      this.select(copies)
    } else if (name === 'delete') {
      this.select([])
      selected.forEach(node => node.destroy())
    } else if (alignment[name]) {
      this.align(...alignment[name])
    } else if (name === 'lock' || name === 'unlock') {
      selected.forEach(node => node.draggable(name === 'unlock'))
      this.select(selected)
    } else {
      const method = { up: 'moveUp', down: 'moveDown', front: 'moveToTop', back: 'moveToBottom' }[name]
      if (!method) return
      selected.forEach(node => node[method]())
    }
    this.commit()
  }

  align(axis, mode) {
    if (this.selected.length < 2) return
    const size = axis === 'x' ? 'width' : 'height'
    const factor = mode === 'min' ? 0 : mode === 'max' ? 1 : 0.5
    const positions = this.selected.map(node => {
      const box = node.getClientRect()
      return box[axis] + factor * box[size]
    })
    const target = mode === 'min' ? Math.min(...positions) : mode === 'max' ? Math.max(...positions) : positions[0]
    this.selected.forEach((node, index) => node[axis](node[axis]() + target - positions[index]))
  }

  resize(width, height) {
    const grid = this.backdrop.findOne('.gridLine')
    this.stage.size({ width, height })
    this.backdrop.findOne('.layer_background').size({ width, height })
    this.backdrop.findOne('.myShapeBackgroundImage')?.size({ width, height })
    this.drawGrid(Boolean(grid), grid?.stroke())
    this.commit()
  }

  drawGrid(enabled, color = '#e3d7ff') {
    this.backdrop.find('.gridLine').forEach(line => line.destroy())
    if (!enabled) return
    const { width, height } = this.stage.size()
    for (let x = 20; x < width; x += 20) this.backdrop.add(new Konva.Line({ name: 'gridLine', points: [x, 0, x, height], stroke: color, strokeWidth: 1 }))
    for (let y = 20; y < height; y += 20) this.backdrop.add(new Konva.Line({ name: 'gridLine', points: [0, y, width, y], stroke: color, strokeWidth: 1 }))
  }

  backgroundImage(source, persist = true) {
    this.backdrop.find('.myShapeBackgroundImage').forEach(node => node.destroy())
    if (persist) this.backdrop.setAttr('backgroundImageURL', source)
    const url = assetURL(source)
    if (url) {
      const image = new Konva.Image({ name: 'myShapeBackgroundImage', ...this.stage.size(), listening: false })
      this.backdrop.add(image)
      image.setZIndex(1)
      paintImage(image, url)
    }
    if (persist) this.commit()
  }

  serialize() {
    return JSON.stringify(sanitizeNode(this.stage.toObject()))
  }

  export() {
    const doc = JSON.parse(this.serialize())
    const keys = dataKeys(doc)
    doc.attrs.dataKeyArray = Object.fromEntries(keys.map(key => [key, '---']))
    const active = this.editLayer.visible()
    this.editLayer.hide()
    let thumbnail = ''
    try {
      thumbnail = this.stage.toDataURL({ pixelRatio: Math.min(1, 500 / Math.max(this.stage.width(), this.stage.height())) })
    } catch {
      // 跨域媒体不能绘制到缩略图时，保留可保存的场景配置。
    } finally {
      this.editLayer.visible(active)
    }
    return { json: JSON.stringify(doc), keys: keys.join(','), thumbnail }
  }

  destroy() {
    this.assets?.abort()
    this.stage?.destroy()
  }
}
