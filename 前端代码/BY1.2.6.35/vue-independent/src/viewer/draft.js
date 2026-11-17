// sessionStorage 在预览窗口内保留到关闭；不能按计时删除，刷新仍需读取草稿。
export function openPreview(json, { storage = sessionStorage, open = window.open.bind(window), href = location.href, key } = {}) {
  storage.setItem(key, json)
  const url = new URL('/byzt/preview.html', href)
  for (const [name, value] of new URL(href).searchParams) {
    if (!['draft', 'id', 'stageId'].includes(name)) url.searchParams.set(name, value)
  }
  url.searchParams.set('draft', key)
  try {
    const child = open(url.href, '_blank', 'popup,width=1100,height=770')
    if (!child) throw new Error('popup blocked')
    // 新窗口获得自己的会话存储副本，父窗口不积累画面数据。
    storage.removeItem(key)
    return child
  } catch (error) {
    storage.removeItem(key)
    throw error
  }
}
