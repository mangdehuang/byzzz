import { asRows } from '../scene/schema.js'

export function httpURL(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return ''
  try {
    const url = new URL(raw, location.origin)
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname.includes('xxxx')) return ''
    return url.href
  } catch {
    return ''
  }
}

export function fieldURL(raw, fields, values) {
  const allowed = httpURL(raw)
  if (!allowed) return ''
  const url = new URL(allowed)
  for (const item of asRows(fields)) {
    if (item.key && Object.hasOwn(values, item.key)) url.searchParams.set(item.name || item.key, String(values[item.key]))
  }
  return url.href
}

// 兼容图表、历史列表和告警控件的表单字段。
export function appendFields(body, name, value) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendFields(body, name + '[' + index + ']', item))
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) appendFields(body, name + '[' + key + ']', child)
  } else {
    body.set(name, String(value ?? ''))
  }
}
