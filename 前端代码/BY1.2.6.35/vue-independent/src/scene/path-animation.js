import { asRows, literal } from './schema.js'

const numeric = value => value == null || value === '' || value === '---' ? NaN : Number(value)

// 路径按真实折线长度计算；保留图元最初与路径起点的偏移。
export class PathAnimations {
  constructor(engine) {
    this.tracks = new Map()
    const nodes = engine.groups()
    for (const node of nodes) {
      const attrs = node.attrs
      if (!attrs.pathAminMethodCall || (String(attrs.Hmove) !== '1' && !attrs.followPath)) continue
      const path = nodes.find(item => item.id() === (attrs.followPath || attrs.trackHid))
      const source = attrs.followPath && nodes.find(item => item.id() === path?.getAttr('sourceId'))
      const settings = source?.attrs || attrs
      const line = path?.findOne('.trackHLine') || path?.findOne('Line')
      const key = asRows(settings.HdataKey)[0]?.key
      const { min, max } = literal(settings.Hscope, {})
      if (!line || !key || !Number.isFinite(numeric(min)) || !Number.isFinite(numeric(max)) || !(numeric(max) > numeric(min))) continue
      const transform = line.getAbsoluteTransform()
      const points = line.points()
      const vertices = []
      for (let i = 0; i + 1 < points.length; i += 2) vertices.push(transform.point({ x: points[i], y: points[i + 1] }))
      if (vertices.length < 2) continue
      let total = 0
      const segments = vertices.slice(1).map((b, i) => {
        const a = vertices[i]
        const start = total
        total += Math.hypot(b.x - a.x, b.y - a.y)
        return { a, b, start, length: total - start }
      }).filter(segment => segment.length > 0)
      if (!Number.isFinite(total) || !total) continue
      const origin = node.absolutePosition()
      const initial = numeric(settings.HinitPosition)
      const track = { key, min: numeric(min), max: numeric(max), total, segments,
        offset: { x: origin.x - vertices[0].x, y: origin.y - vertices[0].y },
        speed: numeric(settings.seppd), current: 0, target: 0 }
      this.tracks.set(node, track)
      if (String(settings.HpathHide) === '1') path.visible(false)
      // 初始位置只用于显示，不向真实点位表填入伪造值。
      if (initial >= track.min && initial <= track.max) track.current = track.target = this.distance(track, initial)
      this.place(node, track)
    }
  }

  distance(track, value) {
    return (value - track.min) / (track.max - track.min) * track.total
  }

  update(values) {
    for (const [node, track] of this.tracks) {
      const value = numeric(values[track.key])
      // 旧版越界时保持当前位置，缺失不能被当成零。
      if (!Number.isFinite(value) || value < track.min || value > track.max) continue
      track.target = this.distance(track, value)
      if (!(track.speed > 0)) {
        track.current = track.target
        this.place(node, track)
      }
    }
  }

  place(node, track) {
    const segment = track.segments.find(item => track.current <= item.start + item.length) || track.segments.at(-1)
    const ratio = Math.min(1, Math.max(0, (track.current - segment.start) / segment.length))
    node.absolutePosition({ x: segment.a.x + (segment.b.x - segment.a.x) * ratio + track.offset.x,
      y: segment.a.y + (segment.b.y - segment.a.y) * ratio + track.offset.y })
  }

  tick(elapsed) {
    let dirty = false
    for (const [node, track] of this.tracks) {
      if (track.current === track.target || elapsed <= 0) continue
      const distance = Math.min(Math.abs(track.target - track.current), track.speed * elapsed / 1000)
      track.current += Math.sign(track.target - track.current) * distance
      this.place(node, track)
      dirty = true
    }
    return dirty
  }
}
