import { asRows, literal } from '../scene/schema.js'
import { dateText } from '../scene/live.js'
import { httpURL } from './widget-data.js'

// 旧画面区分悬停(1)与单击(2)，禁用值不能当成已启用。
export function basicInfo(node, mode) {
  const info = literal(node?.getAttr('basicInfo'))
  return String(info?.showType) === String(mode) && asRows(info.showContent).length ? info : null
}

export function infoValue(row, values, now = new Date()) {
  switch (String(row.type)) {
    case '2': {
      const value = values[row.value?.devicecode]
      return value == null || value === '---' ? '—' : String(value) + (row.unit || '')
    }
    case '3': return dateText('YYYY-mm-dd HH:MM:SS', now)
    case '4': {
      const value = values[row.value?.key?.devicecode]
      if (value == null || value === '---') return '—'
      return asRows(row.value?.state).find(item => String(item.value) === String(value))?.text ?? '状态未匹配'
    }
    default: return String(row.value ?? '') + (row.unit || '')
  }
}

// 兼容旧弹窗的 ?key=point@point 拼接约定，不执行旧 eval 回调。
export function clickDialog(attrs) {
  const info = literal(attrs.clickInfo)
  if (!info?.clickType || String(info.clickType) === '0') return null
  let raw = info.urlContent
  if (typeof raw === 'string' && raw.includes('?')) {
    raw += asRows(attrs.urlParam).filter(row => row.key).map(row => encodeURIComponent(row.key) + '@').join('')
  }
  const url = httpURL(raw)
  return url ? { url, width: info.contentWidth, height: info.contentHeight } : null
}
