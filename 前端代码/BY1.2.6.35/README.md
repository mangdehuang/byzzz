# BY 组态 Vue 前端

当前默认前端为 `vue-independent/`，使用 Vue 3、Element Plus、npm Konva。`pnpm dev` 和 `pnpm build` 都直接使用它，不再读取旧 `byzt/` 或兼容版 `vue/`。唯一 HTML 源入口为 `vue-independent/index.html`，构建产物为 `dist-independent/index.html`。

## 运行与构建

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm dev
pnpm build
```

开发地址为 http://127.0.0.1:5174/byzt/ ，接口代理到本机 Go 8088。构建后进入相邻的 `后端代码Go` 目录执行 `go run .`，访问 http://127.0.0.1:8088/ 。后端 `.env` 已指定独立产物路径；缺少构建时启动报错，不回退旧页面。

`dev:independent`、`build:independent`、`test:independent` 保留为同一实现的别名。部署时需要整个 `dist-independent/`，包括图片、字体、图元 JSON 和 npm 播放器静态资源。`/byzt/` 是保留的访问路径，不代表依赖仓库中的旧 `byzt/` 源码目录。

## 代码结构

- `vue-independent/src/editor/`：编辑器、图元属性、画布、通讯、模板及图库。
- `vue-independent/src/scene/`：场景格式、Konva 编辑操作、实时值与公式。
- `vue-independent/src/viewer/`：预览、监控、图表、历史组件和媒体。
- `vue-independent/src/components/`：设备与画面选择器、属性输入和规则表。
- `vue-independent/public/byzt/`：新前端自己管理的图元、模板、图片、字体及初始化配置。

旧 `byzt/`、兼容版 `vue/` 和旧 `dist/` 仅保留供历史对照，不参与默认构建、启动或交付。

## 不含旧代码的验证与交付

```sh
pnpm verify:standalone
```

此命令白名单复制新源码和 Go 后端到临时目录，在完全没有旧前端目录的情况下离线安装锁定依赖、运行测试、执行默认构建，确认单 HTML，再启动 Go 验证页面、配置、静态资源和画面保存重读，核对旧脚本 URL 返回 404。首次使用须先完成依赖安装以准备 pnpm 缓存，且本机需有 Go 工具链。

成功后产生 `release/byzt-vue-standalone.tar.gz` 和 `release/verification.json`。交付包包含新前端源码、已构建产物、Go 源码及安全默认 `.env` / `.env.example`，不包含旧前端、node_modules、用户数据库或用户填写的密钥。设备令牌默认留空，填写后端 `.env` 后重启；目标机器需要 Go 1.25 以上版本及首次下载依赖的网络。

## 验证边界

**尚未通过与原版效果完全一致的验收。** 详细覆盖及已知差异见 [一致性核验记录](docs/parity-status.md)。

构建与运行独立不等于所有旧画面的行为已验收。现有 100 个基础图元资源和场景格式有回归检查，专用编辑器由 Vue 属性与规则表实现；自定义函数、循环与分支公式可在独立 Worker 计算；依赖旧页面 DOM、旧全局对象或异步网络的脚本仍需适配。MQTT、实际历史接口、萤石摄像头、外部视频和设备反控需要现场服务联调。Go 当前没有现场命令下发实现，控制请求会明确返回失败，不能视作真实反控已完成。

## 预览续迁验证（2026-11-17）

预览已补齐基本信息的悬停/单击、点击弹窗、HTML 图元右键、平滑路径动画、直接拖动、全屏状态、草稿刷新和局部失败重试。Node 回归与浏览器覆盖详见 `docs/parity-status.md`。

可复跑浏览器验收：先运行 `pnpm build`，然后执行 `node scripts/verify-preview.mjs`。执行环境须已提供 Playwright 及 Chromium；若 Playwright 不在项目模块路径中，可通过 `BY_PLAYWRIGHT_MODULE` 指定其绝对模块路径。脚本自动创建临时数据库及 Go/Vite 服务，完成后停止并清理，不改业务数据库；截图及检查清单输出到 `docs/parity-evidence/`。缺失配置的媒体和历史组件只验证空态，不代表现场服务已联调。

显示规范见 `docs/ui-display-standard.md`，公共样式变量在 `vue-independent/src/ui-tokens.less`。应用控件与画布用户图元分开维护。
