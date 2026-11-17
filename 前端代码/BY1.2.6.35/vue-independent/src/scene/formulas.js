import jsep from 'jsep'

const binary = {
  '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b,
  '%': (a, b) => a % b, '**': (a, b) => a ** b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
  '<': (a, b) => a < b, '<=': (a, b) => a <= b, '===': (a, b) => a === b, '!==': (a, b) => a !== b,
  '==': (a, b) => a == b, '!=': (a, b) => a != b,
}
const math = new Set(['abs', 'ceil', 'floor', 'round', 'trunc', 'min', 'max', 'sqrt', 'pow', 'log', 'exp', 'sin', 'cos', 'tan'])
const conversions = { Number, String, Boolean, parseInt, parseFloat, isNaN: Number.isNaN }

function evaluate(node, scope, depth = 0) {
  if (!node || depth > 80) throw new Error('表达式过深')
  const next = item => evaluate(item, scope, depth + 1)
  switch (node.type) {
    case 'Literal': return node.value
    case 'Identifier':
      if (Object.hasOwn(scope, node.name)) return scope[node.name]
      throw new Error('未知变量')
    case 'UnaryExpression': {
      const value = next(node.argument)
      if (node.operator === '-') return -value
      if (node.operator === '+') return +value
      if (node.operator === '!') return !value
      throw new Error('不支持的运算符')
    }
    case 'BinaryExpression': {
      const left = next(node.left)
      if (node.operator === '&&') return left && next(node.right)
      if (node.operator === '||') return left || next(node.right)
      if (!Object.hasOwn(binary, node.operator)) throw new Error('不支持的运算符')
      return binary[node.operator](left, next(node.right))
    }
    case 'ConditionalExpression': return next(node.test) ? next(node.consequent) : next(node.alternate)
    case 'CallExpression': {
      const callee = node.callee
      const args = node.arguments.map(next)
      if (callee.type === 'Identifier' && Object.hasOwn(conversions, callee.name)) return conversions[callee.name](...args)
      if (callee.type === 'MemberExpression' && !callee.computed && callee.object.name === 'Math' && math.has(callee.property.name)) {
        return Math[callee.property.name](...args)
      }
      throw new Error('不支持的函数')
    }
    default: throw new Error('不支持的表达式')
  }
}

// 旧画面中的常见 return 和变量声明式公式采用受限解释，画面配置不会执行任意脚本。
export function calculate(script, values) {
  const scope = Object.create(null)
  let index = 0
  const source = String(script || '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, key) => {
    if (!Object.hasOwn(values, key)) throw new Error('缺少数据点')
    const name = '_point_' + index++
    scope[name] = values[key]
    return name
  })
  // 兼容旧配置里没有分号的换行声明，同时仍只允许受限表达式。
  const statements = source.replace(/\r?\n/g, ';').split(';').map(item => item.trim()).filter(Boolean)
  for (const statement of statements) {
    const definition = statement.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+)$/s)
    if (definition) {
      scope[definition[1]] = evaluate(jsep(definition[2]), scope)
    } else if (/^return\s+/.test(statement)) {
      return evaluate(jsep(statement.replace(/^return\s+/, '')), scope)
    } else if (/^[A-Za-z_$][\w$]*\s*=/.test(statement)) {
      const assignment = statement.match(/^([A-Za-z_$][\w$]*)\s*=\s*(.+)$/s)
      if (!Object.hasOwn(scope, assignment[1])) throw new Error('只能修改已声明变量')
      scope[assignment[1]] = evaluate(jsep(assignment[2]), scope)
    } else {
      throw new Error('不支持的语句')
    }
  }
  return undefined
}
