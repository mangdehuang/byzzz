# AGENTS.md

## 项目定位
- 唯一默认前端为 `vue-independent/`，使用 Vue 3、Element Plus、npm Konva 和 Vite。
- `pnpm dev/build/test` 和带 `:independent` 的别名使用同一独立实现。入口为 `vue-independent/index.html`，产物为 `dist-independent/`。
- 构建或入口变更后运行 `pnpm build`；脱离旧代码的交付验证运行 `pnpm verify:standalone`。
- Go 默认读取新构建；缺少构建时明确报错，不回退旧 HTML。保留 `/byzt/` 的 URL 和画面 JSON 字段兼容。

## 目录速览
- `vue-independent/src/editor/`：编辑器、属性、资源、通讯。
- `vue-independent/src/scene/`：场景、画布、公式、实时值。
- `vue-independent/src/viewer/`：预览、监控、图表及媒体。
- `vue-independent/src/components/`：可复用组件。
- `vue-independent/public/byzt/`：独立维护的静态图元、模板、图片、字体和配置。
- `scripts/verify-standalone.mjs`：不含旧代码的隔离构建与交付包验证。
- 原 `byzt/`、兼容版 `vue/`、旧 `dist/` 只用于历史对照，禁止作为新构建或运行时的依赖。

## 技术与接口约定
- 新页面和属性编辑使用 Vue 与 Element Plus，禁止引入旧 jQuery、Layui、zTree 或旧引擎脚本。
- API 请求由 `vue-independent/src/api.js` 管理；默认同源 Go HTTP/WebSocket 接口。
- 默认连接与界面字典来自 `vue-independent/public/byzt/config/init.json`。
- 真实零值与缺失值必须区分，接口缺失或失败展示空态或提示，不得回填伪造业务数据。
- 修改应保留无关的用户改动。历史源码不得批量删除或覆盖。

## 修改原则
- 保留已保存画面的属性名、数据点编号和 HTTP/WebSocket 协议；旧回调函数名不应成为新前端依赖。
- 不随意改动第三方库与压缩文件（如 *.min.js）。
- 不修改示例数据结构字段名（避免影响旧画面 JSON 兼容）。
- 涉及 UI 调整时，优先局部样式或局部 DOM 修改，避免牵动全局布局。

## 联调与验证
- 修改配置后，至少检查：页面可加载、编辑器工具栏可点击、保存流程无明显报错。
- 修改通信配置后，至少检查：通讯页签中的默认值回填是否正确。
- 修改组件编辑逻辑后，至少检查：组件拖拽、属性修改、保存与重新加载是否正常。

## 常见任务建议
- 隐藏/显示页面元素：优先在目标 DOM 上做最小范围样式修改。
- 对接接口：在 `vue-independent/src/api.js` 管理请求，开发代理由独立 Vite 配置管理。
- 新增界面配置项：在独立前端 init.json 声明，再在对应 Vue 组件或业务模块读取。

## 禁止事项
- 禁止使用破坏性 git 命令覆盖用户改动。
- 禁止在未确认需求时批量替换全项目 URL。
- 禁止因为“代码看起来老”而进行重构式改写。
