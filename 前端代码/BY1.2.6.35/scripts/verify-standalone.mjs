import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backend = resolve(source, '../../后端代码Go')
const temp = mkdtempSync(join(tmpdir(), 'byzt-standalone-'))
const bundle = join(temp, 'byzt-vue-standalone')
const frontend = join(bundle, '前端代码/BY1.2.6.35')
const serverDir = join(bundle, '后端代码Go')
mkdirSync(frontend, { recursive: true })
mkdirSync(serverDir, { recursive: true })

// 白名单复制：隔离副本中从未存在旧 byzt/、兼容版 vue/ 或用户数据库。
for (const name of ['package.json', 'pnpm-lock.yaml', 'vite.config.js', 'vite.independent.config.js', 'vue-independent', 'scripts', 'README.md', 'AGENTS.md', '.gitignore', 'docs/parity-status.md', 'docs/ui-display-standard.md', 'docs/parity-evidence']) {
  mkdirSync(dirname(join(frontend, name)), { recursive: true })
  cpSync(join(source, name), join(frontend, name), { recursive: true })
}
for (const name of readdirSync(backend).filter(name => name.endsWith('.go') || ['go.mod', 'go.sum', 'README.md', '.gitignore', '.env.example'].includes(name))) {
  cpSync(join(backend, name), join(serverDir, name))
}
// 交付配置仅来自不含真实凭据的 example，不复制开发者 .env。
cpSync(join(serverDir, '.env.example'), join(serverDir, '.env'))
writeFileSync(join(bundle, 'README.md'), '# 独立 Vue 组态\n\n本包不含旧前端源码和业务数据库。尚未通过与原版效果完全一致的验收，覆盖及已知差异见前端 docs/parity-status.md。\n\n- 前端：`前端代码/BY1.2.6.35/vue-independent/`。\n- 已构建产物：`前端代码/BY1.2.6.35/dist-independent/`。\n- 启动：进入 `后端代码Go`，执行 `go run .`，访问 http://127.0.0.1:8088/ 。\n- 重新构建：进入前端目录，执行 `pnpm install --frozen-lockfile` 和 `pnpm build`。\n- 设备接入令牌填写在后端 `.env`，默认留空；现场服务联调范围见前端 README。\n')

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, COPYFILE_DISABLE: '1' } })
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed`)
}

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory()
    ? files(join(dir, item.name)) : [join(dir, item.name)])
}

run('pnpm', ['install', '--offline', '--frozen-lockfile'], frontend)
run('pnpm', ['test'], frontend)
run('pnpm', ['build'], frontend)
const output = join(frontend, 'dist-independent')
assert.deepEqual(files(output).filter(file => /\.html?$/i.test(file)), [join(output, 'index.html')])
for (const old of ['byzt', 'vue', 'dist']) assert.equal(existsSync(join(frontend, old)), false)
for (const old of ['js/StageView.js', 'js/stageOperation.js', 'config/InitConfig.js', 'css']) {
  assert.equal(existsSync(join(output, 'byzt', old)), false, old)
}
run('go', ['test', './...'], serverDir)
const binary = join(temp, 'byzt-go')
run('go', ['build', '-o', binary, '.'], serverDir)

// 随机端口、独立数据库；保留 .env 中的默认前端路径，以验证真实加载链路。
const portProbe = createServer()
await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve))
const port = portProbe.address().port
await new Promise(resolve => portProbe.close(resolve))
const env = { ...process.env }
for (const key of Object.keys(env)) if (key.startsWith('BY_')) delete env[key]
env.BY_LISTEN = `127.0.0.1:${port}`
env.BY_DB_PATH = join(temp, 'verification.sqlite')
const child = spawn(binary, [], { cwd: serverDir, env, stdio: ['ignore', 'ignore', 'pipe'] })
let failure = ''
child.stderr.on('data', chunk => { failure += chunk.toString() })
const base = `http://127.0.0.1:${port}`
async function get(path, options) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(5000), ...options })
  assert.equal(response.status, 200, path)
  return response
}

try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(failure)
    try { await get('/byzt/'); ready = true; break } catch { await new Promise(resolve => setTimeout(resolve, 100)) }
  }
  assert.ok(ready, failure || 'server did not start')
  const entry = readFileSync(join(output, 'index.html'), 'utf8')
  for (const path of ['/byzt/', '/byzt/index_edit.html', '/byzt/preview.html', '/byzt/client_view.html']) {
    assert.equal(await (await get(path)).text(), entry)
  }
  for (const match of entry.matchAll(/(?:src|href)="(\/byzt\/[^"]+)"/g)) await get(match[1])
  for (const path of ['/byzt/js/StageView.js', '/byzt/js/stageOperation.js', '/byzt/config/InitConfig.js']) {
    assert.equal((await fetch(base + path)).status, 404, path)
  }
  const config = await (await get('/byzt/config/init.json')).json()
  assert.equal(config.webSocketUrl, '/websocket/message')
  const scene = await (await get('/ims/scene', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stageName: '独立验证', stagedatajson: { className: 'Stage', attrs: { width: 1024, height: 768 }, children: [] } }),
  })).json()
  assert.ok(scene.data.id)
  const saved = await (await get('/ims/scene/' + scene.data.id)).json()
  assert.equal(saved.data.stageName, '独立验证')
  const result = { isolatedDirectory: bundle, htmlEntries: 1, fullParityAccepted: false, legacyRequests: '404', sceneSaveReload: 'passed', configuration: 'loaded from packaged .env' }
  writeFileSync(join(temp, 'verification.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    await exited
  }
}

// 安装依赖仅用于隔离验证，交付包不携带 node_modules 或构建缓存。
const release = join(source, 'release')
mkdirSync(release, { recursive: true })
const archive = join(release, 'byzt-vue-standalone.tar.gz')
run('tar', ['--exclude=node_modules', '--exclude=.vite', '--exclude=.DS_Store', '--exclude=._*', '-czf', archive, '-C', temp, 'byzt-vue-standalone'], source)
cpSync(join(temp, 'verification.json'), join(release, 'verification.json'))
console.log('独立交付包：' + archive)
