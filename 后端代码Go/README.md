# BY 组态 Go 后端

Go 同源托管独立 Vue 编辑器、预览、监控和 HTTP/WebSocket 服务。SQLite 持久化画面、模板、图库和设备目录，启动时为空库。

## 启动

进入本目录，使用 Go 1.25 或以上版本运行：

```sh
go run .
```

- 前端执行 `pnpm build` 后启动 Go，即可在 [http://127.0.0.1:8088/](http://127.0.0.1:8088/) 使用 Vue 编辑器。首次点击「保存」创建画面，地址栏会带上新画面 ID。再次保存更新同一画面。
- 已有画面用 `/byzt/index_edit.html?id=<画面ID>` 编辑，用 `/byzt/preview.html?id=<画面ID>` 预览，用 `/byzt/client_view.html?id=<画面ID>` 打开监控。
- `.env` 由服务启动时加载，进程环境变量优先。默认监听 `127.0.0.1:8088`，库文件为 `data/byzt.sqlite`，前端仅使用 `BY_VUE_DIR` 指向的独立构建资源，默认 `../前端代码/BY1.2.6.35/dist-independent/byzt`。缺少 `index.html` 或 `config/init.json` 会明确报错，启动不依赖原版源码且不再回退旧页面。编辑器接口使用本机单用户模式。接入共享环境时，由部署方提供登录和权限控制。
- `BY_INTEGRATION_TOKEN` 留空时关闭设备目录导入和实时数据写入。启用时填写自己的令牌并重启。换机器运行时，可从 `.env.example` 复制配置。
- 旧画面可通过新增接口传入原 ID 和画面 JSON，保留监控链接及跳转关系。旧画面的通信配置保存在其 JSON 内。若需切换到 Go WebSocket，把画面通讯配置中的地址改为 `/websocket/message` 后保存。

## 接口盘点

画面与设备接口依据当前 `byzt/config/InitConfig.js`、`targetStage.html` 和 `hardwareSelect.html`。模板、分组与上传字段对照同一发行包的若依示例控制器。WebSocket 参考 `WebSocketServer.java`、`WebSocketPool.java` 和实际前端客户端。新增画面路径与设备接入写入接口由 Go 服务定义。

除画面列表、图片和 WebSocket 外，HTTP 成功返回 `{code:200,msg:"操作成功",data:...}`。空列表返回 `[]`。模板保存沿用前端约定，在 `msg` 返回 32 位模板 ID。

| 方法 | 路径 | 参数和用途 | 返回内容 |
| --- | --- | --- | --- |
| POST | `/ims/scene` | JSON，见下方画面字段 | `data` 含完整画面和新 ID |
| PUT | `/ims/scene` | JSON，`id`、`stagedatajson` 必填，其他字段可选 | `data=1` 更新成功，`0` 表示画面已不存在 |
| GET | `/ims/scene/{id}` | 画面 ID，编辑、预览和监控共用 | `data.id`、`stageName`、`stagedatajson`、`stagebase64`、`datakeyarray` |
| GET | `/ztgl/hmgl/list` | `stageName` 模糊筛选，`pageNum`、`pageSize` 分页 | `code`、`msg`、`total`、`rows`。行包含 `stageId`、`stageName`、`stageBase64` |
| GET | `/ims/scene/listProductStage` | 项目列表 | `data[]` 包含 `code`、`name`、`type` |
| GET | `/ims/scene/listDeviceStage` | `parendId` 为项目编号 | 同上，返回该项目设备 |
| GET | `/ims/scene/listParameterStage` | `parendId` 为设备编号 | 同上，返回该设备的数据点 |
| POST | `/ztgl/hmgl/insertTemplateStage` | 表单 `templateId`（修改时填）、`templateName`、`stageDatajson`、`stageBase64`（可选） | `msg` 为模板 ID，`data` 为模板 |
| POST | `/ztgl/hmgl/selectTemplateStageList` | 查询模板 | `data[]` 包含上述模板字段 |
| POST | `/ztgl/hmgl/templateStageDeleteById` | 表单 `templateId` | `data` 为删除条数 |
| POST | `/ztgl/hmgl/saveEditModuleGroup` | 表单 `groupName`，修改时提供 `groupId` | `data` 为保存条数 |
| POST | `/ztgl/hmgl/selectPictureGroupList` | 查询图库分组 | `data[]` 包含 `groupId`、`groupName` |
| POST | `/ztgl/hmgl/pictureGroupDeleteById` | 表单 `groupId` | `data=-1` 表示分组内有图片，否则为删除条数 |
| POST | `/ztgl/hmgl/insertPicture` | multipart 表单 `imagefile`、`groupId`，支持 JPEG、PNG、GIF、SVG，最大 10 MiB | `data` 为上传条数 |
| POST | `/ztgl/hmgl/selectPictureList` | 表单 `groupId` | `data[]` 包含图片 `id` 和同源 `picUrl` |
| POST | `/ztgl/hmgl/pictureDeleteById` | 表单图片 `id` | `data` 为删除条数。图库移除后，已保存画面仍可读取原图 |
| GET | `/byzt-media/{file}` | 图片列表返回的 `picUrl` | 图片文件 |
| PUT | `/api/integration/catalog` | Bearer 令牌、项目/设备/数据点 JSON | 写入的目录条目总数 |
| POST | `/api/integration/telemetry/{stageId}` | Bearer 令牌、绑定编号到实际值的 JSON 对象 | 已加入发送队列的客户端数量 |
| WS | `/websocket/message/{stageId}` | 画面 ID，客户端发送 `sandType` 和 `content` | 服务端返回 `MESSAGETYPE` 和 `MESSAGECONTENT` |

画面字段

- `id` 是画面 ID。新增可省略，由服务生成。迁移时可指定原 ID，重复 ID 返回 409。
- `stageName` 是列表显示名，独立编辑器首次保存使用「未命名画面」。可通过新增或更新接口指定名称。
- `stagedatajson` 是完整 Konva Stage JSON，可传序列化字符串或对象。读接口返回字符串。
- `stagebase64` 是可选的缩略图 data URL。
- `datakeyarray` 是逗号分隔的画面绑定编号，例如绑定键按 `设备编号_点位编号` 组成。设备目录的点位 `code` 仍使用单独的点位编号。
- 普通表单使用 `application/x-www-form-urlencoded`。画面和设备接入使用 JSON。参数错误、资源不存在等返回对应的 HTTP 状态及中文 `msg`。

## 设备与实时数据

通过 `PUT /api/integration/catalog` 导入真实清单，使用 `Authorization: Bearer <BY_INTEGRATION_TOKEN>`。请求体包含三个数组。

- `products[]` 使用 `code`、`name`、可选 `type`。
- `devices[]` 增加 `parentId`，指向产品编号。设备编号全局唯一。
- `points[]` 增加 `parentId`，指向设备编号。同一个点位编号可出现在不同设备下。
- 导入按完整快照替换，错误时保留原有清单。没有导入时返回空列表。

现场网关可把实测值发到 `POST /api/integration/telemetry/{stageId}`。请求体以画面已绑定的编号为键，值为现场数据，真实数值 `0` 会原样传输。服务仅向该画面当前连接的客户端推送 `01`，历史记录和断线重放需由数据平台提供。

- `HEARTCMD` 返回 `05` 心跳。 `LEAVE` 关闭该连接。
- `CONTROLCMD` 解析 `content.stageId`、`dataPointId` 和 `value`。现场命令下发需要设备协议和权限契约，当前返回 `04` 和 `SUCCESS:false`。
- 历史图表、历史表格、告警、MQTT 和第三方视频使用控件自己的数据地址。当前发行包未提供这些业务服务的固定接口和真实数据源。

## 验证

`go test -race ./...` 覆盖画面重开数据库、列表筛选、模板和图库、设备目录替换、同画面广播、跨画面隔离、心跳与控制结果。
