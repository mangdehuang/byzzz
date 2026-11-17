// 仅模拟节点属性和文字测量，以对照新旧算法；不充当浏览器像素渲染验证。
export class SceneDouble {
  constructor(document) {
    this.className = document.className
    this.attrs = structuredClone(document.attrs || {})
    this.children = (document.children || []).map(child => new SceneDouble(child))
  }
  getAttr(key) { return this.attrs[key] }
  setAttr(key, value) { this.attrs[key] = value; return this }
  setAttrs(attrs) { Object.assign(this.attrs, attrs); return this }
  getChildren() { return this.children }
  getLayer() { return { batchDraw() {}, draw() {} } }
  getClassName() { return this.className }
  hasName(name) { return String(this.attrs.name || '').split(' ').includes(name) }
  find(selector) {
    const items = this.children.flatMap(child => [child, ...child.find('*')]).filter(child => selector === '*' ||
      (selector.startsWith('.') ? child.hasName(selector.slice(1)) : child.className === selector))
    items.points = value => items.forEach(child => child.points(value))
    return items
  }
  findOne(selector) { return this.find(selector)[0] }
  getWidth() { return this.width() }
  getHeight() { return this.height() }
  width(value) {
    if (value !== undefined) return this.setAttr('width', value)
    return this.attrs.width ?? (this.className === 'Text' ? String(this.attrs.text || '').length * (this.attrs.fontSize || 12) * 0.6 + 2 * this.padding() : 0)
  }
  height(value) {
    if (value !== undefined) return this.setAttr('height', value)
    return this.attrs.height ?? (this.className === 'Text' ? (this.attrs.fontSize || 12) + 2 * this.padding() : 0)
  }
  snapshot() {
    return { className: this.className, attrs: this.attrs, children: this.children.map(child => child.snapshot()) }
  }
}
for (const key of ['text', 'fill', 'stroke', 'points', 'x', 'y', 'padding', 'rotation', 'fillRadialGradientColorStops']) {
  SceneDouble.prototype[key] = function(value) {
    return value === undefined ? this.attrs[key] ?? (key === 'text' ? '' : 0) : this.setAttr(key, value)
  }
}
SceneDouble.prototype.setFillRadialGradientColorStops = SceneDouble.prototype.fillRadialGradientColorStops
// 属性编辑回归共用的 Konva 尺寸与位置接口。
SceneDouble.prototype.get = SceneDouble.prototype.find
SceneDouble.prototype.position = function(value) {
  return value === undefined ? { x: this.x(), y: this.y() } : this.setAttrs(value)
}
SceneDouble.prototype.size = function(value) {
  return value === undefined ? { width: this.width(), height: this.height() } : this.setAttrs(value)
}
SceneDouble.prototype.strokeWidth = function(value) {
  return value === undefined ? this.attrs.strokeWidth : this.setAttr('strokeWidth', value)
}
