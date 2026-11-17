import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluatePrograms } from '../src/scene/formula-worker.js'
import { FormulaExecutor } from '../src/scene/formula-executor.js'

const programs = [
  ['function double(x) { return x * 2 } return double({{x}})', { x: 0 }, 0],
  ['let sum = 0; for(let i = 0; i < {{count}}; i++) { sum += i; } return sum', { count: 10 }, 45],
  ['if ({{x}} <= 0) { return 0; } else { return 1; }', { x: -1 }, 0],
  ['return [1, 2, 3].map(x => x * {{factor}}).reduce((a,b) => a+b, 0)', { factor: 2 }, 12],
  ['const data = { min: -10, max: 20 }; return Math.max(data.min, Math.min(data.max, {{x}}))', { x: 99 }, 20],
  ['let i = 3; while(i > 0) { i--; } return i;', {}, 0],
  ['return (\n  {{x}} * 2\n)', { x: 3 }, 6],
]
for (const [script, values, expected] of programs) test('legacy JavaScript computation ' + script.slice(0, 45), () => {
  const response = evaluatePrograms([{ id: 'DVAR1', script }], values)
  assert.deepEqual(response.errors, [])
  assert.equal(response.results.DVAR1, expected)
})
test('formula placeholders are values, not executable code', () => {
  const response = evaluatePrograms([{ id: 'DVAR1', script: 'return String({{x}})' }], { x: '); throw new Error("injected");(' })
  assert.equal(response.results.DVAR1, '); throw new Error("injected");(')
})
test('formula dependencies execute in declaration order and failures invalidate dependents', () => {
  const variables = [{ id: 'DVAR1', script: 'function f(x) { return x * 2; } return f({{x}})' },
    { id: 'DVAR2', script: 'return {{DVAR1}} + 1' }]
  assert.equal(evaluatePrograms(variables, { x: 2 }).results.DVAR2, 5)
  assert.deepEqual(evaluatePrograms(variables, {}).errors, ['DVAR1', 'DVAR2'])
})
test('non-transferable asynchronous results are rejected', () => {
  const result = evaluatePrograms([{ id: 'DVAR1', script: 'return Promise.resolve(0)' }], {})
  assert.deepEqual(result.errors, ['DVAR1'])
})
test('worker requests resolve independently and timeout termination rejects all pending work', async () => {
  const OriginalWorker = globalThis.Worker
  let worker
  globalThis.Worker = class {
    constructor() { worker = this; this.sent = [] }
    postMessage(message) { this.sent.push(message) }
    terminate() { this.terminated = true }
  }
  const executor = new FormulaExecutor()
  try {
    const first = executor.evaluate([], {})
    worker.onmessage({ data: { id: worker.sent[0].id, results: { DVAR1: 0 }, errors: [] } })
    assert.equal((await first).results.DVAR1, 0)
    const second = executor.evaluate([], {})
    executor.destroy()
    await assert.rejects(second, /超时或不可用/)
    assert.equal(worker.terminated, true)
  } finally {
    executor.destroy()
    globalThis.Worker = OriginalWorker
  }
})
