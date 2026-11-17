import Konva from 'konva'

const lineTypes = new Set(['FLOWLINE', 'BASELINE', 'TRACKLINE', 'Arrow'])

function lineFor(node) {
  if (!lineTypes.has(node?.getAttr('moduleType'))) return null
  return node.findOne('.backgroundLine') || node.findOne('.line1') || node.findOne('.trackHLine') ||
    node.findOne('Line') || node.findOne('Arrow')
}

function movePoint(node, line, points) {
  line.points(points)
  if (node.getAttr('moduleType') === 'FLOWLINE') node.findOne('.dynamicLine')?.points(points)
}

export function editLine(engine, node) {
  engine.editLayer.find('.byzt-line-handle').forEach(anchor => anchor.destroy())
  const line = lineFor(node)
  if (!line) return false
  const transform = line.getAbsoluteTransform()
  const points = line.points()
  for (let index = 0; index < points.length; index += 2) {
    const position = transform.point({ x: points[index], y: points[index + 1] })
    const handle = new Konva.Circle({
      ...position, name: 'byzt-line-handle', radius: 4, fill: '#fff', stroke: '#2387df', strokeWidth: 1,
      draggable: true, byztEditorOnly: true,
    })
    handle.on('mousedown click tap', event => { event.cancelBubble = true })
    handle.on('dragmove', event => {
      event.cancelBubble = true
      const current = handle.absolutePosition()
      const target = engine.stage.find('.anchor_adsorb')
        .map(anchor => anchor.absolutePosition())
        .filter(position => Math.hypot(position.x - current.x, position.y - current.y) <= 5)
        .sort((a, b) => Math.hypot(a.x - current.x, a.y - current.y) - Math.hypot(b.x - current.x, b.y - current.y))[0]
      if (target) handle.absolutePosition(target)
      const point = line.getAbsoluteTransform().copy().invert().point(target || current)
      const updated = line.points().slice()
      updated[index] = point.x
      updated[index + 1] = point.y
      movePoint(node, line, updated)
      engine.content.batchDraw()
    })
    handle.on('dragend', event => {
      event.cancelBubble = true
      engine.commit()
    })
    handle.on('contextmenu', event => {
      event.evt.preventDefault()
      event.cancelBubble = true
      if (line.points().length <= 4) return
      const updated = line.points().slice()
      updated.splice(index, 2)
      movePoint(node, line, updated)
      editLine(engine, node)
      engine.commit()
    })
    engine.editLayer.add(handle)
  }
  return true
}

export function addLinePoint(engine, node, pointer) {
  const line = lineFor(node)
  if (!line || !pointer) return false
  const current = line.getAbsoluteTransform().copy().invert().point(pointer)
  const points = line.points().slice()
  let closest
  for (let index = 2; index < points.length; index += 2) {
    const a = { x: points[index - 2], y: points[index - 1] }
    const dx = points[index] - a.x
    const dy = points[index + 1] - a.y
    const size = dx ** 2 + dy ** 2
    if (!size) continue
    const ratio = Math.max(0, Math.min(1, ((current.x - a.x) * dx + (current.y - a.y) * dy) / size))
    const projected = { x: a.x + dx * ratio, y: a.y + dy * ratio }
    const distance = Math.hypot(current.x - projected.x, current.y - projected.y)
    if (!closest || distance < closest.distance) closest = { index, distance, ...projected }
  }
  if (!closest) return false
  points.splice(closest.index, 0, closest.x, closest.y)
  movePoint(node, line, points)
  engine.select([node])
  engine.commit()
  return true
}
