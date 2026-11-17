// 编译与循环在单独线程中执行，超时可终止，不阻塞画布和编辑器。
export class FormulaExecutor {
  constructor() {
    this.pending = new Map()
  }

  evaluate(variables, values) {
    if (!this.worker) {
      this.worker = new Worker(new URL('./formula-worker.js', import.meta.url), { type: 'module' })
      this.worker.onmessage = ({ data }) => {
        const task = this.pending.get(data.id)
        if (!task) return
        clearTimeout(task.timer)
        this.pending.delete(data.id)
        task.resolve(data)
      }
      this.worker.onerror = () => this.destroy()
    }
    const id = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.destroy(), 1000)
      this.pending.set(id, { resolve, reject, timer })
      try {
        this.worker.postMessage({ id, variables, values })
      } catch {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(new Error('公式数据不可传递'))
      }
    })
  }

  destroy() {
    this.worker?.terminate()
    this.worker = null
    for (const task of this.pending.values()) {
      clearTimeout(task.timer)
      task.reject(new Error('公式计算超时或不可用'))
    }
    this.pending.clear()
  }
}
