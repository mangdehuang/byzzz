# 独立 Vue 预览续迁计划

目标：补齐旧版预览在独立 Vue 中缺失的交互，保留画面 JSON 与点位协议，不依赖历史脚本。

1. 对照旧版 `preview.html`、`StageView.js` 和 `moduleAnimation.js`，核对工具栏、信息展示、弹窗、拖动和路径动画。
2. 调整 `viewer/ViewerPage.vue`、`WidgetOverlay.vue` 和 `behaviors.js`：横向数据栏、全屏状态、局部加载/重试、悬停/单击信息、点击弹窗及 HTML 图元事件。
3. 修复编辑器到预览的草稿传递：保留 URL 参数；关闭弹窗阻止时给出提示；预览重载不丢草稿。
4. 将路径定位和逐帧移动独立为 `scene/path-animation.js`，覆盖路径偏移、初始位、速度、反向回程、追随配置、隐藏路径、缺失/越界点位。
5. 执行相关 Node 回归和浏览器操作验证，检查桌面、窄屏、强制旋转、全屏、草稿重载和错误重试。涉及预览与编辑器共享场景运行时，执行完整 Node 回归；交付验证使用 `pnpm verify:standalone`。
6. 更新 `docs/parity-status.md`。真实 MQTT、历史、视频和设备下发只记录实际联调范围，不以本地验证替代现场验收。

本轮保持用户已有修改，不提交、不推送、不部署。
