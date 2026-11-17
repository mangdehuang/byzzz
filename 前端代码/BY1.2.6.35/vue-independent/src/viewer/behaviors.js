import { asRows, literal } from '../scene/schema.js'
import { fieldURL, httpURL } from './widget-data.js'

function pageURL(id) {
  const url = new URL('/byzt/client_view.html', location.origin)
  for (const [key, value] of new URLSearchParams(location.search)) {
    if (!['id','stageId','draft'].includes(key)) url.searchParams.set(key, value)
  }
  url.searchParams.set('id', id)
  return url.href
}

export function activateNode(node, event, context) {
  const attrs = node.attrs
  const double = event.type === 'dblclick' || event.type === 'dbltap'
  if (event.button != null && event.button !== 0) return
  const enabled = asRows(attrs.eventBehaviour).filter(item =>
    String(item.isOpenEvent) === '1' && String(item.eventType || '1') === (double ? '2' : '1'))
  if (enabled.length) {
    for (const item of enabled) runBehavior(item.eventBehaviour || item, context)
    return
  }
  if (double || event.button != null && event.button !== 0) return
  if (attrs.moduleType === 'BUTTON_JUMP') {
    const target = literal(attrs.jumpTarget)?.targetCode
    if (target) context.open(pageURL(target), String(attrs.JumpType) === '2' ? '3' : '2', attrs.playframesize)
  } else if (['BUTTON','BUTTONVALUE','BUTTON_IMPULSES'].includes(attrs.moduleType)) {
    const key = asRows(attrs.dataKey)[0]?.key
    const click = asRows(attrs.clickWhere)[0] || {}
    const value = click.content ?? attrs.defaultValue
    if (attrs.moduleType === 'BUTTON' && String(click.code) === '2') {
      context.open(click.content, '1')
    } else if (key && attrs.moduleType === 'BUTTONVALUE') {
      context.prompt(key, attrs.defaultValue, attrs.clientMessage)
    } else if (key && attrs.moduleType === 'BUTTON_IMPULSES') {
      const pulse = asRows(attrs.clickSignalsWhere)[0]
      if (pulse) context.send(key, pulse.start, undefined, { value: pulse.end, delay: Math.max(0, Number(pulse.time) || 0) * 1000 })
    } else if (key && value != null) context.send(key, value)
  } else if (String(attrs.readWriteFlag) === '2') {
    // 旧版可写变量同样弹出设值入口，不能只迁移 BUTTONVALUE。
    const key = asRows(attrs.dataKey)[0]?.key
    if (key) context.prompt(key, attrs.defaultValue, attrs.clientMessage)
  } else if (/IMAGES_SWITCH/.test(attrs.moduleType)) {
    const key = asRows(attrs.dataKey)[0]?.key
    const rows = asRows(attrs.where)
    const value = context.values[key]
    // 原版发送当前状态行的 command，不能自行轮换到下一行。
    const candidate = rows.find(row => !['def', 'default'].includes(row.status) && String(row.status) === String(value))
    if (key && candidate?.command != null && candidate.command !== '') context.send(key, candidate.command)

  }
}

function runBehavior(behavior, context) {
  switch (String(behavior.behaviourType)) {
    case '1': {
      const url = fieldURL(behavior.behavior_link, behavior.behavior_link_param, context.values)
      if (url) context.open(url, behavior.openMode, behavior.windowSize)
      break
    }
    case '2': {
      const target = behavior.behavior_picture?.targetCode
      if (target) context.open(pageURL(target), behavior.openMode, behavior.windowSize)
      break
    }
    case '3': {
      const key = behavior.behavior_variate?.key
      if (!key) break
      if (String(behavior.operateMode) === '2') {
        context.prompt(key, behavior.defaultValue, behavior.behavior_client_message)
      } else if (String(behavior.operateMode) === '3') {
        const mode = String(behavior.clickMode)
        const first = ['2','3'].includes(mode) ? 1 : 0
        context.send(key, first, behavior.behavior_client_message, ['3','4'].includes(mode)
          ? { value: 1 - first, delay: Math.max(0, Number(behavior.delayTime) || 0) * 1000 }
          : null)
      } else {
        context.send(key, behavior.fixedValue, behavior.behavior_client_message)
      }
      break
    }
    case '4':
      for (const [key, visible] of [['show',true],['hide',false]]) {
        for (const item of asRows(behavior.mShowHide?.[key])) {
          context.engine.groups().find(node => node.id() === item.id)?.visible(visible)
        }
      }
      context.redraw()
      break
    case '5': {
      const items = asRows(behavior.submitInput).map(item => {
        const node = context.engine.groups().find(node => node.id() === item.id)
        return [asRows(node?.getAttr('dataKey'))[0]?.key, context.input[item.id]]
      }).filter(([key, value]) => key && value !== undefined)
      if (items.length) context.submit(items, behavior.behavior_client_input_message)
      break
    }
  }
}

export function openExternal(raw, mode, size, dialog) {
  const url = httpURL(raw)
  if (!url) return
  if (String(mode) === '2') location.assign(url)
  else if (String(mode) === '3') dialog(url, size)
  else window.open(url, '_blank', 'noopener')
}
