import { cpSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import sirv from 'sirv'

const backend = 'http://127.0.0.1:8088'
const root = resolve(import.meta.dirname, 'vue-independent')
const output = resolve(root, '../dist-independent')
const require = createRequire(import.meta.url)
const cameraAssets = resolve(require.resolve('ezuikit-js/package.json'), '../ezuikit_static')
const workerEnv = '/@fs' + resolve(require.resolve('vite/package.json'), '../dist/client/env.mjs')

export default defineConfig({
  root,
  plugins: [
    vue(),
    {
      name: 'byzt-page-aliases',
      configureServer(server) {
        server.middlewares.use('/byzt/camera-sdk', sirv(cameraAssets))
        // 保留系统嵌入链接。页面类型由 Vue 根据原地址判断。
        server.middlewares.use((req, res, next) => {
          const path = req.url.split('?')[0]
          // 兼容公式只计算，Worker 不可加载脚本或访问任何网络接口。
          if (path.endsWith('/formula-worker.js')) {
            // Vite 开发模式自动插入唯一的 env 模块，仅放行这个精确资源。
            const environment = 'http://' + req.headers.host + encodeURI(workerEnv)
            res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-eval' " + environment + "; connect-src 'none'")
          }
          if (path === '/byzt/' || /^\/byzt\/.*\.html$/.test(path)) req.url = '/index.html'
          next()
        })
      },
      writeBundle() {
        cpSync(cameraAssets, resolve(output, 'byzt/camera-sdk'), { recursive: true })
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: {
      '^/(ims|ztgl|api|byzt-media)(/|$)': { target: backend, changeOrigin: false },
      '/websocket': { target: backend, ws: true, changeOrigin: false },
    },
  },
  build: {
    outDir: output,
    emptyOutDir: true,
    assetsDir: 'byzt/assets',
  },
})
