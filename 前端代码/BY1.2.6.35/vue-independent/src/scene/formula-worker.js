const programs = new Map()

// 完整 JavaScript 计算仅供隔离 Worker 使用；不在页面主线程调用。
export function evaluatePrograms(variables, input) {
  const values = Object.assign(Object.create(null), input)
  const results = Object.create(null)
  const errors = []
  for (const item of variables) {
    try {
      const script = String(item.script || '')
      if (script.length > 100000) throw new Error('公式过长')
      let program = programs.get(script)
      if (!program) {
        const references = []
        const body = script.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, raw) => {
          const key = raw.trim()
          references.push(key)
          return '_points[' + JSON.stringify(key) + ']'
        })
        program = { references, run: new Function('_points', '"use strict";\n' + body) }
        if (programs.size > 200) programs.clear()
        programs.set(script, program)
      }
      if (program.references.some(key => !Object.hasOwn(values, key))) throw new Error('缺少数据点')
      const value = program.run(values)
      // 同步计算结果必须能通过线程消息传递；Promise/函数不属于点位值。
      structuredClone(value)
      values[item.id] = value
      results[item.id] = value
    } catch {
      errors.push(item.id)
      delete values[item.id]
    }
  }
  return { results, errors }
}

if (typeof self !== 'undefined' && typeof document === 'undefined') {
  self.onmessage = ({ data }) => {
    const result = evaluatePrograms(data.variables, data.values)
    self.postMessage({ id: data.id, ...result })
  }
}
