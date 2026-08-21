# 技术栈选型调研 — 基于 DSL 航线编辑脚本的大疆航线编辑 Agent

> 调研类型：本地代码调研 + 知识评估（无外部网络搜索）
> 调研日期：2026-08-21
> 调研者：@researcher（flow-research）
> 服务对象：dm-007（决策映射中的技术栈选型 Ticket）
> 结论性质：**推荐 + 证据 + 风险**；决策权在编排器/用户

---

## 0. 结论摘要（TL;DR）

| 决策点 | 推荐 | 关键证据 | 主要风险 |
|---|---|---|---|
| 后端语言 | **Go 模块化单体** | yuchen-smart-ops 后端全 Go；先行实现 Go 全链路已验证（含 GBH 201 实测） | 与前端不同语言，需契约管理 |
| 前端框架 | **React + Vite + TS**（若确定深度复用 yuchen-smart-ops 前端资产则改 Vue3） | 先行实现 React 19 + Cesium 1.144 可行；yuchen-smart-ops 为 Vue3 | 两参考方不一致，需产品定位决断 |
| Cesium 集成 | **原生 `cesium` 包**，自封装 MapView 组件（不用 resium） | 两个参考项目均为原生 Cesium 直接集成 | 包体积大；API 学习成本 |
| 地图底图 | **天地图 WMTS 为主 + 可配置回退 Esri World Imagery** | yuchen-smart-ops 用天地图 WMTS；先行实现因软渲染失败弃天地图改 Esri | token 泄露；软渲染环境失败 |
| 存储 | **SQLite**（Go 用 modernc.org/sqlite 纯 Go 驱动，零 CGO） | 先行实现与 open-api 后端均用 SQLite | 多写并发弱（单机演示无碍） |
| LLM 调用层 | **openai 兼容 SDK 或标准库手写** + 自封装 `LlmProvider` 接口（可插拔） | 先行实现标准库手写非流式；yuchen-smart-ops demandAgent 有双 Provider 接口范式 | 流式 SSE 需自行处理 |

---

## 1. 范围与方法

- 调研对象：参考来源 1 `~/project/yuchen-smart-ops/`（一网统飞平台，本地一手代码）、参考来源 2 `~/project/airline-dsl-ai-demo/`（先行实现，仅作存在性佐证）。
- 方法：本地源码 + 文档交叉验证；所有结论标注文件路径与行号；无外部来源，无网络检索。
- 先行实现的关系：按 dm-001 决策，**本方案完全独立创新，不以先行实现为输入**；本文对先行实现仅引用其技术可行性证据。

---

## 2. 参考来源 1：yuchen-smart-ops 实证

### 2.1 前端地图方案（Cesium + 天地图 + WGS-84）

**技术栈**：Vue 3.5 + Vite 6 + TypeScript + Element Plus（`frontend/package.json:79,64,127`）；地图用 **Cesium 原生包**（`cesium ^1.128.0`，`frontend/package.json:59`），无 resium 等 React/Vue 封装。

**天地图底图**：通过 `Cesium.WebMapTileServiceImageryProvider`（WMTS）接入：
- 影像底图 `img_w` + 影像标注 `cia_w`（`frontend/src/views/airline-design/components/CameraPreviewWindow.vue:216-236`）
- 矢量底图 `vec` + `cva`（`frontend/src/components/BaseMapSwitcher.vue:60-75`）
- token 来源：`window.config.tiandituToken`（`frontend/public/static/config.js:3`），硬编码于前端静态配置（内网部署可接受，公网有泄露风险）
- 封装：`utils/ctrlCesium/BaseCesium.ts:288-312`（`createTdtImageryProvider`）

**WGS-84 处理**：
1. Cesium 原生即 WGS-84 椭球，经纬度直接使用（如 `Cesium.Cartesian3.fromDegrees`，先行实现 `RouteMap.tsx:65,100`）。
2. 偏移坑意识：`docs/adr/0011-canghai-campus-demo.md:32`（D6）——「机巢锚定 + 相对推演（避免真实坐标的 GCJ-02/WGS-84 偏移坑）」。
3. 提供 GCJ-02 ⇔ WGS-84 转换工具：`frontend/src/views/airline-design/utils/coord-transform.ts:1-7`（大疆司空 2 用 WGS84，中国地图数据为 GCJ-02，需转换）。
4. open-api 接口明确要求 WGS-84（`docs/temp/open-api-waypoint-route(1).md:324`）。

**结论**：本项目「沧海校区 WGS-84 基准」无需特殊处理——Cesium 直接消费 WGS-84 经纬度；仅当底图数据或第三方标注混入 GCJ-02 时需转换（可复用 coord-transform.ts 算法）。

### 2.2 open-api-waypoint-route 开放接口契约（GBH 提交目标）

文档：`docs/temp/open-api-waypoint-route(1).md`（345 行，以下字段均出自此文档；本仓库 GBH 前端客户端类型亦已按此对齐：`frontend/src/api/gbh/simulation.ts:6-33`）。

**请求**（POST `/api/open/routes`）：

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `name` | string | 否 | 自动生成 | 航线名称 |
| `aircraft_model` | string | 否 | `M30` | M30/M30T/M350/M3E/M3T/M3M/M3TA/M3D/M3TD/M4E/M4T/M4D/M4TD/M400（文档 3.5） |
| `takeoff` | object | **是** | - | `lat`/`lng`（必填）、`altitude`（默认 0） |
| `waypoints` | array | **是** | - | 至少 1 个；每项 `lat`/`lng` 必填 |
| `global_height` | number | 否 | `120` | 全局高度（m） |
| `global_speed` | number | 否 | `15` | 全局速度（m/s） |
| `finish_action` | string | 否 | `goHome` | goHome/noAction/autoLand/backToFirstPoint |
| `rth_altitude` | number | 否 | `100` | 返航高度 |
| `takeoff_security_height` | number | 否 | `50` | 起飞安全高度 |
| `exit_on_rc_lost` | string | 否 | `goContinue` | goContinue/executeLostAction |
| `altitude_mode` | string | 否 | `relativeToStartPoint` | relativeToStartPoint/absolute/AGL |

**waypoints[] 可选字段**（文档 3.3）：
- `altitude`（<=0 用全局）、`speed`（<=0 用全局）
- `heading_mode`（followWayline/towardPOI/manually/fixed）、`heading_angle`（fixed 时生效）
- `turn_mode`（clockwise/counterClockwise）
- `poi`（towardPOI 时生效，结构同 takeoff）
- `actions[]`：`{action_type, action_params}`

**actions[] 支持动作**（文档 3.4）：`hover`（hover_time 默认 5）、`takePhoto`（file_suffix/payload_lens_index: wide/zoom/ir）、`startRecord`、`stopRecord`、`focus`、`zoom`（focal_length 默认 24）、`rotateYaw`、`gimbalRotate`（云台多字段）、`panoShot`、`orientedShoot`、`customDirName`。

**响应**（文档 5）：201 返回完整航线对象（`id`、`waypoints[].index` 从 0 起、`use_global_height`/`use_global_speed`、`actions[].action_params` 为 JSON 字符串、RFC3339 时间）；400/500 返回 `{"error": "..."}`（文档 5.2/常见错误表）。

**注意事项**（文档 7）：WGS-84；坐标越界返回 400；**接口未开启鉴权**；`takeoff` 只作起飞位置标记不写入执行序列。

**关联接口**（文档 6）：`GET /api/routes`、`GET /api/routes/:id`、`GET /api/routes/:id/kmz`（返回 KMZ）、`POST /api/mqtt/deploy-route`。

### 2.3 几何生成 / 动作映射逻辑（可参考实现）

**三形态几何模板**（`frontend/src/views/unified-flight/TaskGenerator/templates/scene-templates.ts`，80 行）：
- `buildOrbitWaypoints`（L19-38）：以 center 为圆心、radiusM 米为半径生成 count 个均匀航点；简化球面换算 `METERS_PER_DEG_LAT = 111000`，经度按纬度余弦缩放（L12-14）。
- `buildLineWaypoints`（L43-61）：start→end 按 spacingM 插值，`count = max(2, ceil(dist/spacing)+1)`。
- `buildSweepWaypoints`（L69-80）：包装 `generatePolygonRoute`（S 形扫掠）。

**面状 S 形扫掠**（`frontend/src/views/airline-design/utils/polygon-route-generator.ts`，444 行）：
- 算法链：经纬度→平面投影（L91-97）→ 多边形收缩（边距，L175-195）→ 旋转对准扫描方向（L121-130,312）→ 包围盒（L137-149）→ 水平扫描线与多边形求交（L323-360，奇偶行反向实现 S 形）→ 共线点优化（L202-228）→ 反向旋转 → 反投影回经纬度（L106-112,373-378）。
- 附带相机参数驱动的间距计算（GSD 公式，L66-82）——本项目 MVP 可不需要。

**动作映射范式**（`frontend/src/views/unified-flight/TaskGenerator/composables/useGbhSubmit.ts:5-25`）：
- 中文动作名 → GBH 动作类型：拍照→`takePhoto`(wide)、悬停→`hover`(5s)、录像→`startRecord`(wide)、红外拍照→`takePhoto`(ir)、云台控制→`gimbalRotate`；起飞/返航→跳过（返航由 `finish_action: 'goHome'` 表达，L18-21）。
- 动作挂载规则：段内 actions 映射后挂到该段**首个业务航点**（L28-33,51）。
- 默认请求体：`aircraft_model: 'M350'`、`global_height: 120`、`global_speed: 15`、`finish_action: 'goHome'`、`rth_altitude: 100`、`takeoff_security_height: 50`、`exit_on_rc_lost: 'goContinue'`、`altitude_mode: 'relativeToStartPoint'`（L55-71）。

**DSL 语言实现**（本项目「DSL 航线编辑脚本」的直接参考）：
- `frontend/src/views/unified-flight/TaskGenerator/composables/useDslParser.ts`（631 行）：Python 子集 **Lexer + Parser** 完整实现——词法（标识符含中文、数字含指数、字符串、注释、换行，L35-211）+ 语法（`route = Route("名")`、`route.target("DJI")`、`route.config(k=v,...)`、`route.waypoint(lng, lat, alt)`、动作方法调用挂到当前航点，L215-508）+ AST→航段编译（L546-609）。
- DSL 关键词表：`TaskGenerator/constants/dsl-keywords.ts`。
- 三场景模板由 DSL 生成/编译驱动：`docs/adr/0011-canghai-campus-demo.md:19`（「DSL 编译语言能力是真实代码，不是设想」）。

**沧海校区场景定义**（`docs/adr/0011-canghai-campus-demo.md`）：
- 唯一真实机巢「深大测试-大疆机场3」坐标 `113.935066, 22.531635`（L11）——与本项目 dm-005 锚定一致。
- 三大演示场景：楼宇巡检（环绕 L2 楼）、路面巡检（直线）、草坪巡检（之字扫掠）（L13-15）——与本项目「环绕/直线/之字」几何类型完全对应。

### 2.4 GBH 模拟飞行平台地址与提交契约

**前端提交链路**：
- 代理：`/api/mockflight` → `http://192.168.8.151:8085`（`frontend/vite.config.ts:128-133`，注意注释：必须位于 `/api` 代理之前）。
- 提交函数：`frontend/src/api/gbh/simulation.ts:49-68`（原生 fetch，不走 axios 拦截器——独立服务、无 token）。
- 契约源注明：simulation.ts:2「接口文档：docs/temp/open-api-waypoint-route(1).md」。

**地址端口不一致点（需实测确认）**：
- yuchen-smart-ops 前端代理指向 `192.168.8.151:8085`（vite.config.ts:131）。
- 先行实现 README/集成测试指向 `http://192.168.8.151:5175`（airline-dsl-ai-demo/server/README.md:27、`server/internal/gbh/client_integration_test.go:18`，注释「spike 3 已验证 201 可行」）。
- open-api 文档 8 提到 `DRONE_SIM_URL` 默认 `http://localhost:8081`（文档 8 表格）。
- **推断**：GBH 为 yuchen-smart-ops 代码库之外的独立服务（backend 全库 grep 无 mockflight/GBH 服务源码），地址可配置且曾变更过端口；**本项目需把 GBH base URL 做成环境变量并实测**。
- **补充边界**：open-api 接口的后端实现位于独立项目 `Airline-Generator`（open-api 文档 8 引用其 config.go 为 Windows 路径 `file:///c:/Users/13210/Desktop/Airline-Generator/backend/config/config.go`）；已核查本机 `~/project/` 下无该仓库。即：**GBH/open-api 平台 = 外部独立服务，本项目只能通过 HTTP 契约交互，无法查看其实现**（本机亦无其源码可交叉验证字段实现细节）。

### 2.5 对话编排参考（demandAgent）

- `frontend/src/services/demandAgent/agentEngine.ts:32-116`：`runAgent` 为 async generator，产出事件链 `geocode → intent → form → validate → text → done`。
- **多轮澄清草稿合并**（agentEngine.ts:17-30 `mergeDraft`）：非 undefined 字段覆盖、其余保留（FR-013），补充单字段不丢失已有字段——与 dm-003「多轮澄清缺参追问」对应。
- **可插拔 LLM Provider**（`frontend/src/services/demandAgent/providers.ts:54-70+`）：`LlmProvider` 接口 + `LocalRuleProvider`（本地规则、免密钥可演示）+ `DeepSeekProvider`（SSE 流式）。
- 注意：yuchen-smart-ops 的 DeepSeek key 在**前端环境变量**（`VITE_DEEPSEEK_KEY`，providers.ts:15）+ nginx `/llm` 代理；**本项目 dm-006 已拍板服务端持 Key**，此为有意差异，不照搬其 key 位置。

---

## 3. 参考来源 2：airline-dsl-ai-demo 技术栈（存在性佐证）

仅作可行性证据，不视为约束（dm-001）。

| 层 | 技术 | 证据 |
|---|---|---|
| 后端 | **Go 1.25 模块化单体**：chi 路由 + modernc.org/sqlite（纯 Go 无 CGO）+ 六模块分层（agent/intent/validator/generator/gbh/store） | `server/go.mod:1-20`、README.md:10-18 |
| 前端 | **React 19 + Vite + TypeScript + Cesium 1.144 原生**（无 resium），ChatPanel + RouteMap 组件 | `frontend/package.json:12-26`、RouteMap.tsx:1-8 |
| 底图 | Esri World Imagery（UrlTemplateImageryProvider，无 token、CORS 友好） | RouteMap.tsx:54-61 |
| LLM | 标准库手写 DeepSeek chat completions（`response_format: json_object`、temperature 0.2） | `server/internal/llm/client.go:14-19,66-122` |
| GBH | 标准库手写 HTTP 客户端，POST `{base}/api/open/routes`，处理 201/400/500 | `server/internal/gbh/client.go:26-71` |
| 存储 | SQLite WAL 模式，routes 表（intent_json/content_json/gbh_route_id/status） | `server/internal/store/store.go:39-62` |
| 几何 | Go 移植 yuchen-smart-ops 算法（orbit/line/sweep），TS 对拍测试保证 | `server/internal/generator/geometry.go:1-3,17-76` |
| 意图 schema | Geometry=orbit/line/sweep + 高度/速度/拍照间隔/云台/返航等字段 + 默认值 | `server/internal/intent/schema.go:7-68` |
| 校验/追问 | 字段级校验 + 可疑规则（提到「拍」但未提取拍照→反问） | `server/internal/validator/validator.go:27-69` |
| SSE 事件流 | `intent → validation → stream → route`（Event 结构 + 回调推送） | `server/internal/agent/agent.go:19-124` |

**关键可行性结论**：Go + 原生 Cesium + SQLite + 手写 LLM/GBH 客户端的全链路**已被先行实现跑通**（含 GBH 真实集成测试 201 通过），证明本方案技术栈组合无致命障碍。

---

## 4. 技术栈选型推荐（含理由与风险）

### 4.1 后端：Go 模块化单体（推荐） vs Node/TypeScript

**推荐 Go**，理由（按权重）：
1. **融合铺路**：yuchen-smart-ops 后端为 Go 微服务（`backend/*/go.mod`，go-zero + gorm + PostgreSQL），本 Agent 若并入其体系，Go 语言一致、契约/工具链（protobuf、gorm）可复用。
2. **已验证**：先行实现 Go 全链路（LLM 提取→校验→几何→GBH 提交→SQLite）跑通，几何算法有 TS 对拍测试（`generator_ts_compat_test.go`）。
3. **部署简单**：单二进制 + 内置静态资源托管（先行实现 main.go 方案；open-api 文档 8 也注明「后端托管 frontend/dist」），零运行时依赖。
4. **并发与流式**：SSE 流式回复 + 多会话并发，Go goroutine 模型天然合适；GBH/LLM 外部调用超时控制简单。

**风险**：
- 前后端语言分裂（Go vs TS）→ 契约需以 OpenAPI/JSON schema 固化；本项目结构化输出（Intent/AirlineContent）均为 JSON，风险可控。
- Go 的 LLM SDK 生态弱于 Node → 见 4.5 缓解。
- 与 yuchen-smart-ops 融合若走「嵌入其前端」路径，后端接口需对齐其网关路由（/operation 等），增加适配成本。

**Node/TS 备选**：同语言共享类型、LLM SDK 生态好；代价是放弃与 Go 后端体系融合、无先行实现佐证。**不推荐**，除非确定独立部署且团队 Node 熟练度显著更高。

### 4.2 前端：React + Vite vs Vue3 + Vite

**证据对比**：
- Vue3 阵营：yuchen-smart-ops 前端 = Vue 3.5 + Vite + Element Plus + 原生 Cesium（package.json），且拥有**大量可复用资产**（BaseCesium.ts 天地图封装、demandAgent、useDslParser、scene-templates、polygon-route-generator）。
- React 阵营：先行实现 = React 19 + Vite + 原生 Cesium，已交付对话式 Agent UI + 地图预览 + 一键 GBH。

**推荐（条件化）**：
- **默认推荐 React + Vite + TS**：本 Agent 是独立创新的 agent 原生应用，核心交互是对话流式 UI（React 生态成熟）；先行实现证明 React+Cesium 原生集成无坑；React 无历史包袱、状态模型（useState/context）与流式事件（SSE）配合直接。
- **若产品定位确定要深度融入 yuchen-smart-ops 前端**（复用其 ctrlCesium 封装、demandAgent、Element Plus 组件体系）→ **改选 Vue3 + Vite**，此时复用收益远超框架偏好。

**风险**：
- 两参考方框架不一致 → 决策依赖「独立产品 vs 融合嵌入」的产品定位，此点需在 dm-007 决议前由编排器确认。
- Cesium 与 React 的生命周期管理（viewer 创建/销毁）需自封装（先行实现 RouteMap.tsx:84-87 的 `useEffect` 清理模式可参考）。

### 4.3 Cesium 集成：@cesium/engine 原生 vs resium

**推荐原生 `cesium` 包**（含静态资源 worker 拷贝）：
- 两个参考项目均为原生集成（`cesium ^1.128.0` / `^1.144.0`），无 resium；先行实现用 `vite-plugin-static-copy` 拷贝 `Build/Cesium` 到 `/cesium/` 并设 `CESIUM_BASE_URL`（RouteMap.tsx:8）。
- 本项目需要的是**程序化渲染**（航点/连线/机巢标记/视角飞行，`viewer.entities.add` + `camera.flyTo`），resium 的声明式组件（`<Polyline/>` 等）收益有限，反而引入版本耦合与抽象层。
- 自封装一个 `MapView` 组件（Props: `route: AirlineContent | null`）即够用，与先行实现 RouteMap.tsx 模式一致。

**风险**：
- 包体积大（约 30-60MB 资源）→ 生产构建需静态资源拷贝策略（vite-plugin-static-copy）与按需裁剪。
- Cesium 1.1xx 的 breaking change（如 1.144 无 `imageryLayers.errorEvent`，RouteMap.tsx:43 注释）→ 锁版本并在升级时回归测试。
- 若不用 resium，React 侧需自己管理 viewer 生命周期与实体清理（先行实现已有成熟模式可抄）。

### 4.4 地图底图：天地图 vs 其他

**推荐：天地图 WMTS 为主 + 可配置回退**：
- yuchen-smart-ops 生产在用天地图（img_w+cia_w / vec+cva，token 走 `window.config`），覆盖中国区域影像清晰。
- **反方证据**：先行实现明确弃用天地图——「天地图 JPEG 瓦片在软渲染环境（SwiftShader/llvmpipe）纹理上传失败 'source image could not be decoded'，真实 GPU 亦不保险」改 Esri World Imagery（RouteMap.tsx:54-61）。且 yuchen-smart-ops 注释指出 Cesium Ion 默认底图在国内网络受限会崩溃（RouteMap.tsx:29）。
- **建议**：默认天地图（内网演示场景 yuchen-smart-ops 已验证），底图 provider 做成配置项（天地图/Esri/高德），软渲染环境或 token 失效时一键回退 Esri（无 token、CORS 友好）。

**风险**：
- **token 泄露**：yuchen-smart-ops 把 token 硬编码进 `public/static/config.js`（config.js:3），公网部署即泄露。本项目建议 token 放服务端环境变量、经 `/api/map-token` 下发或直接由后端代理瓦片请求。
- 天地图 WMTS 是 `http://`（非 https，`BaseCesium.ts:293`），公网部署会混入不安全内容 → 内网演示无碍，公网需注意。
- 天地图服务稳定性/限流未在本仓库中见到证据。

### 4.5 存储：SQLite（推荐）

**推荐 SQLite**：
- open-api 后端即 SQLite（`airline_gen.db`，文档 8 环境变量 `DB_DSN`）；先行实现亦 SQLite WAL（store.go:45）。
- 数据规模（航线记录 + JSONB 内容）单文件足矣；零部署零运维。
- Go 侧用 **modernc.org/sqlite**（纯 Go 实现，无 CGO）——先行实现已用（go.mod:7），交叉编译友好。
- 存储 schema 可直接借鉴先行实现 routes 表：`id/name/region/intent_json/content_json/gbh_route_id/status/created_at`（store.go:49-58）。

**风险**：多写并发弱（SQLite 单写锁）——单机演示无碍；若未来并入 yuchen-smart-ops 体系，其 PG+PostGIS 可作为升级路径（`backend/operation/go.mod:10`），SQLite 的 JSON 存储结构可平滑迁移。

### 4.6 LLM 调用层：Go openai 兼容 SDK 选择

**选项对比**：

| 方案 | 优点 | 缺点 | 证据/依据 |
|---|---|---|---|
| A. 标准库手写 | 零依赖、完全可控、先行实现已验证非流式 | 流式 SSE 解析需自写；错误处理要自己铺 | 先行实现 `llm/client.go:1-122` |
| B. `github.com/sashabaranov/go-openai` | 社区最活跃的 Go OpenAI 兼容客户端；`CreateChatCompletionStream` 流式开箱即用；response_format 支持 | 第三方依赖；DeepSeek 特有字段（如 reasoner 的 reasoning_content）需自定义 | 知识评估（未在本仓库验证，标注中置信度） |
| C. `github.com/cohesion-org/deepseek-go` | 专为 DeepSeek 封装 | 小众、维护不确定性高 | 知识评估 |

**推荐 B（sashabaranov/go-openai）+ 自封装 `LlmProvider` 接口**：
- 接口设计直接借鉴 yuchen-smart-ops `providers.ts` 的 `LlmProvider`（providers.ts:54-70）：`name + streamReply() AsyncGenerator` 范式；Go 侧对应 `interface LlmProvider { Stream(ctx, msgs) (<-chan Delta, error) }`，可插拔 DeepSeek/本地规则/未来其他 provider（满足 dm-006「可插拔 provider」）。
- 流式需求（dm-003 多轮澄清 + 打字机回复）要求 provider 支持 SSE；B 方案比手写更省事且经社区验证。
- 若追求零依赖，A 方案手写 SSE 解析也可行（解析 `data:` 行 + `[DONE]`），工作量约 50-80 行，但**不推荐**作为默认，可作回退。

**风险**：B 方案 SDK 的模型参数名与 DeepSeek 偶有差异（需 `BaseURL: https://api.deepseek.com` + 自定义 response 结构兜底）；流式时 JSON mode 提取意图需等完整响应（意图提取不流式、回复流式，混合策略）。

---

## 5. 反方搜索与遗漏检查

1. **「不选 Go」的反方**：若团队无 Go 经验、或确定永不融合 yuchen-smart-ops → Node/TS 全栈亦可，但放弃已验证路径。已标注为条件性否决。
2. **「不用天地图」的反方**：先行实现的软渲染失败是真实踩坑记录（RouteMap.tsx:46-56 注释），若演示环境为虚拟机/无 GPU → 天地图可能翻车。缓解：底图可配置 + 默认值建议 Esri（或提供双底图切换，yuchen-smart-ops 的 BaseMapSwitcher 可参考）。
3. **GBH 地址不一致**（8085/5175/8081 三处）：**未在仓库内解决**，必须实测；建议后端 `GBH_BASE_URL` 环境变量 + 健康检查（GET /healthz 或直接 POST 最小 payload）。
4. **鉴权缺失**：open-api 接口「未开启鉴权」（文档 7），且 simulation.ts 注释「独立服务、无 token」——公网部署时 GBH 与后端之间需内网隔离或自加鉴权。
5. **多轮澄清的工程化**：yuchen-smart-ops demandAgent 的多轮澄清靠 `mergeDraft` 草稿合并（agentEngine.ts:17-30）；先行实现的追问靠 validator 报错后 `buildCorrection` 引导（agent.go:157-164）。两者均为「规则式追问」而非「LLM 自由对话补参」——**本项目若需要更自然的追问，需评估 LLM 上下文携带 schema 的方式**，这是两个参考项目都未覆盖的空缺。
6. **流式回落的边界**：LLM 不可用时（key 失效/网络）需有降级（先行实现是报错重试；yuchen-smart-ops 有 LocalRuleProvider 兜底——后者更稳）。
7. **Cesium 3D 扩展**：yuchen-smart-ops 有 3D Tiles（建筑/倾斜摄影，config.js:30-32）与相机视锥预览（airline-design/modules/action），MVP 可不做，但架构上预留 `viewer.imageryLayers`/`entities` 扩展点。

---

## 6. 置信度评估

| 结论 | 置信度 | 依据 |
|---|---|---|
| open-api 请求/响应字段结构 | **高** | 一手文档 + 前端类型 + 先行实现 payload 三方一致 |
| GBH 提交契约（POST /api/open/routes，201 成功） | **高** | 先行实现集成测试实测通过（client_integration_test.go:14 注释） |
| GBH 平台地址端口 | **低→待实测** | 8085（yuchen-smart-ops）/5175（先行实现）/8081（文档）不一致 |
| yuchen-smart-ops 前端 = Vue3 + 原生 Cesium + 天地图 | **高** | package.json + 多文件交叉 |
| 天地图软渲染失败弃用（先行实现） | **中** | 单一来源（RouteMap.tsx 注释），但属真实环境记录 |
| Go 模块化单体全链路可行 | **高** | 先行实现完整代码 + 测试佐证 |
| sashabaranov/go-openai 流式能力 | **中** | 知识评估，未在本仓库验证（需在选型后 spike 验证） |

---

## 7. 推荐组合（汇总）与待决事项

**推荐技术栈**：
- 后端：**Go 1.24+ 模块化单体**（chi 路由），internal 分层：agent/intent/validator/generator/gbh/store/llm（沿用先行实现已验证的模块划分）
- 前端：**React 19 + Vite + TypeScript**（若确认深度融合 yuchen-smart-ops 则切 Vue3）
- 地图：**原生 `cesium`** + 自封装 MapView；底图 **天地图 WMTS（token 服务端注入）为主、Esri World Imagery 可配置回退**
- 存储：**SQLite（modernc.org/sqlite，WAL）**
- LLM：**sashabaranov/go-openai（流式）或标准库手写** + 自封装 `LlmProvider` 接口（可插拔）；`BaseURL` 指向 DeepSeek
- GBH：自封装客户端，`GBH_BASE_URL` 环境变量，契约按 open-api 文档 3.1-3.4
- 几何：Go 实现 orbit/line/sweep（简化球面换算 `111000 m/deg` 算法，与 yuchen-smart-ops scene-templates 一致）
- 坐标：全链路 WGS-84；GCJ-02 转换工具按需引入（coord-transform.ts 算法移植）

**待编排器/用户决断**：
1. 前端框架最终选择（独立产品 → React；深度融合 → Vue3）——影响后续所有前端方案。
2. GBH 平台实际地址与可用性（需一次性实测确认端口）。
3. 演示环境是否软渲染（决定底图默认值：软渲染/无 GPU → Esri 默认）。
4. LLM SDK 走「SDK（B）」还是「手写（A）」——建议 B，成本低风险小。

---

## 8. 参考文件清单（一手来源）

**yuchen-smart-ops（一网统飞）**：
- `docs/temp/open-api-waypoint-route(1).md` — 开放接口完整契约（请求 3.1-3.4 / 响应 5 / 错误 5.2 / 关联 6 / 注意 7 / 部署 8）
- `frontend/src/api/gbh/simulation.ts` — GBH 提交客户端类型与实现
- `frontend/src/views/unified-flight/TaskGenerator/composables/useGbhSubmit.ts` — 中文动作→GBH 动作映射
- `frontend/src/views/unified-flight/TaskGenerator/templates/scene-templates.ts` — orbit/line/sweep 三模板
- `frontend/src/views/airline-design/utils/polygon-route-generator.ts` — S 形扫掠生成器
- `frontend/src/views/airline-design/utils/coord-transform.ts` — GCJ-02/WGS-84 转换
- `frontend/src/views/airline-design/types/airline-content.ts` — AirlineContent 前端契约
- `frontend/src/views/unified-flight/TaskGenerator/composables/useDslParser.ts` — DSL Lexer/Parser/编译
- `frontend/src/services/demandAgent/{agentEngine,providers,types}.ts` — 对话编排、LLM Provider 可插拔、多轮澄清合并
- `frontend/src/utils/ctrlCesium/BaseCesium.ts`、`frontend/src/components/BaseMapSwitcher.vue`、`frontend/public/static/config.js` — 天地图接入与 token
- `frontend/vite.config.ts:126-148` — GBH mockflight 代理
- `frontend/package.json` — Vue3/Vite/Cesium 版本
- `docs/adr/0011-canghai-campus-demo.md` — 沧海校区场景与坐标策略
- `backend/{operation,datagateway,iam}/go.mod` — 后端 Go 技术栈

**airline-dsl-ai-demo（先行实现，仅可行性佐证）**：
- `server/go.mod`、`frontend/package.json` — Go + React + Cesium 版本
- `server/internal/{agent,llm,gbh,generator,intent,validator,store}/*.go` — 全链路实现
- `server/internal/gbh/client_integration_test.go` — GBH 201 实测
- `frontend/src/components/RouteMap.tsx` — 原生 Cesium + Esri 底图 + 天地图弃用记录
- `README.md` — 架构与配置
