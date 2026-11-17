# BY 组态独立前端

Vue 3、Element Plus 和 npm Konva 组成新的编辑器。构建入口为 `vue-independent/index.html`，产物为 `dist-independent/index.html`。运行资源在 `dist-independent/byzt/`，包括历史图元及模板数据、图片、字体、播放器依赖和新编译的脚本。

```sh
pnpm install --frozen-lockfile
pnpm test:independent
pnpm build:independent
pnpm dev:independent
```

开发入口 [http://127.0.0.1:5174/byzt/](http://127.0.0.1:5174/byzt/) 连接本机 8088 的 Go API。Go 托管构建产物时，将 `BY_VUE_DIR` 指向 `dist-independent/byzt`，例如从 Go 项目目录启动：

```sh
BY_VUE_DIR='../前端代码/BY1.2.6.35/dist-independent/byzt' go run .
```

## 验证范围

- 在没有原始 `byzt/`、兼容版 `vue/` 和原构建配置的目录里安装依赖、运行测试和构建。
- 用该构建产物单独启动 Go 服务。Chrome 验证添加和拖放、复制、撤销恢复、图层、三级设备绑定、未保存预览、画面新增和重载编辑、模板保存、图库分组及图片上传。
- 接入临时 Go 数据库和 WebSocket。校验心跳正常、点位实值 `0` 改变绑定图元的画布内容。网络记录没有旧版脚本、Layui 或 jQuery 请求。
- 资产清单含 100 项基础图元、406 项图库图元、341 项装饰和 2 个预设模板。测试核对了清单数量、图元引用的本地资源、历史绑定字段与场景格式。

## 切换状态

`pnpm dev/build/test` 已统一使用独立版，Go 8088 仅使用新构建，缺少产物会报错。可运行 `pnpm verify:standalone` 生成不含旧代码的隔离验证和交付包。旧系统的部分专用编辑器由通用属性与规则表接管；虚拟变量支持常量、声明、赋值、数学函数和数据点模板，并以独立 Worker 兼容自定义函数、循环、分支等 JavaScript 计算；脚本限时 1 秒，不能访问页面 DOM、旧全局对象或网络。MQTT、历史接口、萤石摄像头、外部视频及设备反控仍需对应现场服务联调。

## 公式 Worker 的静态托管

使用随包 Go 服务时，`formula-worker-*.js` 响应已设置 `Content-Security-Policy: default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'`。若自行改用其他静态服务器，需要为该 Worker 资源保留同样的响应头，才能维持网络隔离。此策略仅作用于公式线程，普通页面和媒体资源沿用原有加载方式。
