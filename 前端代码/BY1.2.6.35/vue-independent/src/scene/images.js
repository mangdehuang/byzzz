import { decompressFrames, parseGIF } from 'gifuct-js'
import { assetURL, asRows } from './schema.js'

const sharedImages = new Map()

function loadImage(source) {
  if (!sharedImages.has(source)) {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    const loaded = new Promise((resolve, reject) => {
      image.onload = () => resolve(image)
      image.onerror = () => {
        sharedImages.delete(source)
        reject(new Error('图片无法加载'))
      }
    })
    sharedImages.set(source, loaded)
    image.src = source
  }
  return sharedImages.get(source)
}

export function paintImage(node, source) {
  const url = assetURL(source)
  if (!url) return Promise.resolve(false)
  const key = Symbol()
  node.imageRequest = key
  return loadImage(url).then(image => {
    if (node.imageRequest !== key || !node.getParent()) return false
    node.image(image)
    if (!node.width()) node.width(image.naturalWidth)
    if (!node.height()) node.height(image.naturalHeight)
    node.getLayer()?.batchDraw()
    return true
  }).catch(() => false)
}

function animatedImage(node, source, signal) {
  return fetch(source, { signal }).then(response => {
    if (!response.ok) throw new Error('GIF 加载失败')
    return response.arrayBuffer()
  }).then(data => {
    const gif = parseGIF(data)
    const frames = decompressFrames(gif, true)
    if (!frames.length || signal.aborted) return
    const canvas = document.createElement('canvas')
    canvas.width = gif.lsd.width
    canvas.height = gif.lsd.height
    const context = canvas.getContext('2d')
    const patch = document.createElement('canvas')
    const patchContext = patch.getContext('2d')
    node.image(canvas)
    if (!node.width()) node.width(canvas.width)
    if (!node.height()) node.height(canvas.height)
    let cursor = 0
    let timer
    let previous
    let saved
    const paint = () => {
      if (signal.aborted || !node.getParent()) return
      if (previous?.disposalType === 2) {
        context.clearRect(previous.dims.left, previous.dims.top, previous.dims.width, previous.dims.height)
      } else if (previous?.disposalType === 3 && saved) {
        context.putImageData(saved, 0, 0)
      }
      const frame = frames[cursor]
      saved = frame.disposalType === 3 ? context.getImageData(0, 0, canvas.width, canvas.height) : null
      patch.width = frame.dims.width
      patch.height = frame.dims.height
      patchContext.putImageData(new ImageData(frame.patch, patch.width, patch.height), 0, 0)
      context.drawImage(patch, frame.dims.left, frame.dims.top)
      node.getLayer()?.batchDraw()
      previous = frame
      cursor = (cursor + 1) % frames.length
      if (frames.length > 1) timer = setTimeout(paint, Math.max(20, frame.delay || 100))
    }
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
    paint()
  }).catch(() => {
    if (!signal.aborted) return paintImage(node, source)
  })
}

export function hydrateGroup(group, { signal, animate }) {
  const source = group.getAttr('imageURL') || asRows(group.getAttr('where')).find(row => ['default','def'].includes(row.status))?.icon
  const images = group.find('Image')
  return Promise.all(images.map(node => {
    const url = assetURL(node.getAttr('imageURL') || source)
    if (url && animate && /\.gif(?:[?#]|$)/i.test(url)) return animatedImage(node, url, signal)
    return paintImage(node, url)
  }))
}
