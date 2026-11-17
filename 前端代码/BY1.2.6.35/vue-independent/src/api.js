const params = new URLSearchParams(location.search)
export const sceneID = () => new URLSearchParams(location.search).get('id') || new URLSearchParams(location.search).get('stageId') || ''

async function send(path, { method = 'GET', body, signal } = {}) {
  const headers = new Headers()
  if (params.get('token')) headers.set('Authorization', 'Bearer ' + params.get('token'))
  if (body && !(body instanceof URLSearchParams) && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(body)
  }
  const response = await fetch(path, { method, headers, body, signal })
  const data = await response.json()
  if (!response.ok || (data.code != null && data.code !== 200)) throw new Error(data.msg || '请求失败')
  return data
}

const form = (action, values) => send('/ztgl/hmgl/' + action, { method: 'POST', body: new URLSearchParams(values) })
const devicePath = '/ims/scene/'
export const api = {
  scene: async id => (await send(devicePath + encodeURIComponent(id))).data,
  save: async body => (await send('/ims/scene', { method: body.id ? 'PUT' : 'POST', body })).data,
  scenes: (name, pageNum, pageSize, signal) => send('/ztgl/hmgl/list?' + new URLSearchParams({
    stageName: name, pageNum, pageSize,
  }), { signal }),
  catalog: async (kind, parent, signal) => {
    const suffix = { project: 'listProductStage', device: 'listDeviceStage', point: 'listParameterStage' }[kind]
    const query = parent ? '?' + new URLSearchParams({ parendId: parent }) : ''
    return (await send(devicePath + suffix + query, { signal })).data
  },
  templates: async () => (await form('selectTemplateStageList')).data,
  saveTemplate: async values => (await form('insertTemplateStage', values)).msg,
  deleteTemplate: async templateId => (await form('templateStageDeleteById', { templateId })).data,
  groups: async () => (await form('selectPictureGroupList')).data,
  saveGroup: async (groupName, groupId = '') => (await form('saveEditModuleGroup', { groupName, groupId })).data,
  deleteGroup: async groupId => (await form('pictureGroupDeleteById', { groupId })).data,
  pictures: async groupId => (await form('selectPictureList', { groupId })).data,
  deletePicture: async id => (await form('pictureDeleteById', { id })).data,
  upload: async (groupId, imagefile) => {
    const body = new FormData()
    body.set('imagefile', imagefile)
    body.set('groupId', groupId)
    return (await send('/ztgl/hmgl/insertPicture', { method: 'POST', body })).data
  },
}

// 图元清单及连接默认值属于应用资源，可独立于业务接口加载。
export const resource = name => send('/byzt/config/' + name + '.json')
