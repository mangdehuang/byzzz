import { literal } from '../scene/schema'

const topics = value => String(value || '').split(',').map(topic => topic.trim()).filter(Boolean)

function websocketAddress(raw, stageID) {
  const url = new URL(raw, location.origin)
  if (url.protocol === 'http:') url.protocol = 'ws:'
  if (url.protocol === 'https:') url.protocol = 'wss:'
  if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('通信地址格式无效')
  const base = url.pathname.replace(/\/$/, '')
  if (base.endsWith('/websocket/message')) url.pathname = base + '/' + encodeURIComponent(stageID)
  return url
}

export function connectStage(id, attrs, config, { data, status, notice }) {
  let socket
  let reconnect
  let heartbeat
  let mqtt
  let stopped = false

  function sendWS(sandType, content) {
    if (socket?.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify({ sandType, content: { stageId: id, ...content } }))
    return true
  }

  function startWS() {
    if (stopped) return
    try {
      socket = new WebSocket(websocketAddress(attrs.webSocket.websocketUrl || config.webSocketUrl, id))
    } catch {
      status('ws', '地址无效')
      return
    }
    status('ws', '连接中')
    socket.addEventListener('open', () => {
      status('ws', '已连接')
      const ping = () => sendWS('HEARTCMD', { value: '00000' })
      ping()
      heartbeat = setInterval(ping, 10000)
    })
    socket.addEventListener('message', event => {
      const message = literal(event.data, {})
      if (message.MESSAGETYPE === '01') data(message.MESSAGECONTENT)
      if (message.MESSAGETYPE === '04') notice(message.MESSAGECONTENT, message.SUCCESS === false ? 'warning' : 'success')
      if (message.MESSAGETYPE === '05') status('heartbeat', '正常')
    })
    socket.addEventListener('close', () => {
      clearInterval(heartbeat)
      if (stopped) return
      status('ws', '已断开，正在重连')
      status('heartbeat', '等待')
      reconnect = setTimeout(startWS, 2500)
    })
  }

  async function startMQTT() {
    const url = attrs.mqtt.mqttUrl || config.mqttUrl
    if (!url) return status('mqtt', '未配置地址')
    try {
      const { connect } = await import('mqtt')
      if (stopped) return
      mqtt = connect(url, {
        username: attrs.mqtt.mqttUser || config.mqttUser || undefined,
        password: attrs.mqtt.mqttPawss || config.mqttPawss || undefined,
        forceNativeWebSocket: true,
      })
      mqtt.on('connect', () => {
        status('mqtt', '已连接')
        const subscriptions = topics(attrs.mqtt.Topics)
        if (subscriptions.length) mqtt.subscribe(subscriptions, { qos: 2 })
      })
      mqtt.on('message', (_topic, payload) => data(literal(payload.toString())))
      mqtt.on('close', () => { if (!stopped) status('mqtt', '已断开') })
      mqtt.on('reconnect', () => status('mqtt', '正在重连'))
      mqtt.on('error', () => status('mqtt', '连接失败'))
    } catch {
      status('mqtt', '连接失败')
    }
  }

  if (String(attrs.webSocket.webSocketIsOn) === '1') startWS()
  if (String(attrs.mqtt.mqttIsOn) === '1') startMQTT()

  return {
    command(dataPointId, value) {
      if (String(attrs.controlType.type) !== '2') return sendWS('CONTROLCMD', { dataPointId, value })
      const targets = topics(attrs.controlType.controlTopics)
      if (!mqtt?.connected || !targets.length) return false
      for (const target of targets) {
        mqtt.publish(target, JSON.stringify({ dataPointId, value }), { qos: 2 }, error => {
          if (error) notice('MQTT 指令发送失败', 'error')
        })
      }
      return true
    },
    close() {
      stopped = true
      clearInterval(heartbeat)
      clearTimeout(reconnect)
      if (socket) {
        sendWS('LEAVE', {})
        socket.close()
      }
      mqtt?.end(true)
    },
  }
}
