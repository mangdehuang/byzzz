# BYZZZ 组态工作台

Vue 3 + Element Plus + Konva 独立前端与 Go HTTP/WebSocket 后端。保留 `/byzt/` 访问路径和已有画面 JSON 字段。

## 启动

1. 进入 `前端代码/BY1.2.6.35`，运行 `pnpm install --frozen-lockfile`、`pnpm build`。
2. 进入 `后端代码Go`，复制 `.env.example` 为 `.env`，执行 `go run .`（Go 1.25+）。
3. 打开 http://127.0.0.1:8088/byzt/ 。开发模式可在前端目录运行 `pnpm dev`，访问 http://127.0.0.1:5174/byzt/ 。

`.env.example` 提供本地监听、SQLite、前端资源目录的默认值；设备集成令牌留空，按需要填写自己的值。运行环境变量可覆盖 `.env`。私有配置与数据库不提交。

## 验证与文档

- 前端 `pnpm test`：604 项 Node 回归。
- 前端 `pnpm verify:standalone`：隔离安装、测试、生产构建、Go 回归及保存重读，无旧引擎依赖。
- 前端 `node scripts/verify-preview.mjs`：要求已构建，执行环境提供 Playwright/Chromium；可用 `BY_PLAYWRIGHT_MODULE` 指定模块路径。使用临时数据库，输出截图与检查清单。
- [显示规范](前端代码/BY1.2.6.35/docs/ui-display-standard.md)：字号、控件、间距与滚动。
- [迁移验收记录](前端代码/BY1.2.6.35/docs/parity-status.md)：验证覆盖、证据和未完成的现场联调。
- [前端说明](前端代码/BY1.2.6.35/README.md)、[后端说明](后端代码Go/README.md)。

仓库包含独立实现与必要静态资源。真实 MQTT、历史数据、视频和设备指令仍需现场服务验收；本地构建与测试不代表全参数视觉等价或设备已执行。
