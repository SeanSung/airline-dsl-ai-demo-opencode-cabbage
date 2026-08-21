# 基于 DSL 航线编辑脚本的大疆航线编辑 Agent — 技术方案

> 状态：Draft v0.2 · 2026-08-21（v0.1 + §11.1 交互与视觉设计）
> 前置：PRD `docs/prd/airline-dsl-edit-agent.md`（已确认）；Decision Map `docs/dev/decision-map.md`（dm-012 已拍板 pi agent toolkit + 全 TS 单栈）
> 本方案只做工程决策（how）；范围与验收见 PRD
> 关联 ADR：`docs/adr/2026-08-21-pi-agent-toolkit-ts-stack.md`、`docs/adr/2026-08-21-sse-streaming.md`

---

## 1. 目标与范围

在空仓库中从零构建一个**独立 agent 原生应用**：用户自然语言对话 → 多轮澄清缺参 → LLM 提取结构化意图 → 规则几何（MVP 仅环绕 orbit）→ AirlineContent → 校验 → 地图预览 → 一键提交 GBH 模拟飞行平台验证 → SQLite 落库历史管理。

MVP 范围与明确不做的事项以 PRD §5/§6 为准。本方案解决"如何构建"：技术栈落地、仓库布局、Server 模块划分、API 契约、数据模型、多轮澄清实现路径、降级策略、Testing Decisions。

## 2. 技术选型决策

| 决策点 | 选择 | 为什么不用更简单的替代 |
|---|---|---|
| 包管理/仓库 | **npm workspaces** monorepo（`server/` + `frontend/` + `shared/`） | npm workspaces 是 Node 原生能力，零额外工具；pnpm 需额外安装且与仓库现有 `npm test`/release 工具链不一致 |
| Server 运行时 | **Bun**（pi 官方以 `bun build --compile` 分发 coding-agent，兼容有官方佐证） | Bun 内置 `bun:sqlite`、`bun test`、TS 直跑，全 TS 单栈零构建步骤最省事；pi 的 `engines: node >= 22.19` 要求 Bun 天然满足。回退路径：Node 24（两运行时下代码无差异，SQLite driver 差异被 Store Module 封装） |
| HTTP/SSE 框架 | **Hono** | 全 TS 一等公民、原生 `streamSSE`、运行时中立（Bun/Node 均可，与回退路径兼容）、零依赖轻量。Express 是 CJS 时代产物、TS 类型体验差、SSE 需手写；Fastify 重且 schema 优先对本项目结构过配 |
| LLM 调用 | **`@earendil-works/pi-ai`**（`openai-completions` API 适配器 + TypeBox tool calling + 事件流） | 已拍板（dm-012）。DeepSeek 走 OpenAI 兼容通道，service 端环境变量持 Key |
| Agent 运行时 | **`@earendil-works/pi-agent-core` 的 `Agent` 类**（agent loop + tool 分发 + 事件流 + 纯 JSON 状态） | 已拍板（dm-012）。**不引入** experimental 的 protocol/server/client，**不引入** coding-agent 专属的 harness 层（见 ADR-0001） |
| 流式传输 | **SSE**（POST 请求体即 SSE 响应流，`fetch` + ReadableStream 读取） | 单向流（server→client）即够：客户端消息走普通 POST；SSE 复用 HTTP、无 WebSocket 握手/心跳/重连/状态机复杂度（见 ADR-0002） |
| 存储 | **SQLite（`bun:sqlite`）**，两表 `routes` + `conversations` | 单机演示数据量单文件足矣；`AirlineContent` JSON 单一权威落库；会话状态为纯 JSON 零成本落库 |
| 多轮澄清 | **`generate_route` tool 的 execute 内 TypeBox 参数校验，缺参 throw → 错误编码进 toolResult 回灌 LLM → LLM 一次只问一项** | 见 §6。比 `ask_clarification` 工具少一个 tool、少一次 LLM 判断，流程强制（缺参必反问）且确定性可测 |
| 降级策略 | **`intent/fallback.parseIntent()` 关键词规则引擎**，LLM 失败时兜底，产物标注 `aiGenerated: false` | 与 yuchen-smart-ops `LocalRuleProvider` 同思路；规则解析是纯函数，无额外基础设施 |
| 前端状态 | React `useReducer` + Context（不引入状态管理库） | 演示应用状态面窄（对话流 + 当前航线 + 历史列表），状态库属过度设计 |
| 地图 | 原生 `cesium` + 天地图 WMTS（token 服务端下发）+ 可配置回退 Esri | 两参考项目均为原生集成；`buildCesiumEntities(content)` 抽纯函数保证可测（见 §11） |
| 类型共享 | **`shared/` workspace 包**，只放纯类型与常量（Intent/AirlineContent/SSE 事件/枚举） | 有 2 个真实消费方（server 构建 + frontend 渲染），契约类型双写会漂移 |

## 3. 仓库结构

```
airline-dsl-ai-demo-opencode-cabbage/
├── package.json              # npm workspaces root（scripts 聚合 test/build/dev）
├── shared/                   # 契约包：纯类型 + 常量（无运行时逻辑、零依赖）
│   ├── package.json          #   name: "@airline-dsl/shared"
│   └── src/
│       ├── intent.ts         #   Intent 类型 + 默认值常量
│       ├── airline-content.ts#   AirlineContent/waypoint/action 类型 + 枚举白名单
│       ├── events.ts         #   SSE 事件契约类型（text_delta/clarification/route_generated/error/done）
│       └── constants.ts      #   机巢锚点、111000 m/deg、默认全局参数、校验常量
├── server/                   # Bun + Hono + pi + SQLite
│   ├── package.json          #   name: "@airline-dsl/server"，deps: hono、@earendil-works/pi-ai、@earendil-works/pi-agent-core、typebox、@airline-dsl/shared
│   └── src/
│       ├── index.ts          # 入口：加载 config → 组装 store/agent → 启动 Hono
│       ├── config.ts         # 环境变量解析（GBH_BASE_URL/DEEPSEEK_*/TIANDITU_TOKEN/DB_PATH/…）
│       ├── http/             # Hono 路由 + SSE 桥（薄层，只做参数校验/状态码/事件转发）
│       │   ├── app.ts        #   组装所有路由的 Hono 实例（测试直调 app.request）
│       │   ├── conversation.routes.ts
│       │   ├── route.routes.ts
│       │   └── sse.ts        #   SSE 写流工具（对齐 shared/events.ts）
│       ├── agent/            # 领域 agent（深度 Module，复杂性集中于此）
│       │   ├── system-prompt.ts
│       │   ├── tools.ts      #   generate_route tool（TypeBox schema + execute）
│       │   ├── session.ts    #   pi Agent 实例的创建/恢复/订阅（会话状态序列化接口）
│       │   └── errors.ts     #   MissingIntentParamsError / AirlineValidationError
│       ├── intent/           # 意图 schema + 默认值 + 合并 + 降级解析
│       │   ├── schema.ts     #   TypeBox schema + required 集合
│       │   ├── merge.ts      #   缺参补齐合并（非 undefined 覆盖）
│       │   └── fallback.ts   #   fallback.parseIntent(text) 关键词规则解析
│       ├── geometry/         # 纯函数
│       │   └── orbit.ts      #   orbitWaypoints({center, radiusM, count})
│       ├── airline/          # AirlineContent 构建 + 校验
│       │   ├── builder.ts    #   buildAirlineContent(intent)
│       │   └── validator.ts  #   validateAirlineContent(content)
│       ├── gbh/
│       │   └── client.ts     #   GBH HTTP client（fetch 注入，可替换）
│       ├── store/            # SQLite
│       │   ├── db.ts         #   bun:sqlite 打开/迁移
│       │   ├── routes.ts     #   RouteRepository
│       │   └── conversations.ts # ConversationRepository
│       └── test/             # bun test 用例（.test.ts）
└── frontend/                 # React 19 + Vite + TS + Cesium
    ├── package.json          #   name: "@airline-dsl/frontend"，deps: cesium、react、@airline-dsl/shared
    ├── vite.config.ts        #   Cesium 静态资源拷贝（vite-plugin-static-copy）
    └── src/
        ├── main.tsx / App.tsx
        ├── state/            # useReducer + Context（conversation/route/history）
        ├── api/              # http client + SSE 读取器（fetch + ReadableStream）
        │   ├── client.ts
        │   └── useChatStream.ts  # hook：POST 消息 → 流式事件驱动 state
        ├── components/
        │   ├── ChatPanel.tsx
        │   ├── RouteMap.tsx  # 原生 Cesium viewer 薄壳（生命周期管理）
        │   ├── HistoryPanel.tsx
        │   └── RouteCard.tsx # 含"非 AI 生成"标注位
        ├── lib/
        │   └── cesium-entities.ts  # buildCesiumEntities(content) 纯函数
        └── types/            # 复用 @airline-dsl/shared 类型
```

## 4. 端到端时序

### 4.1 生成闭环（正常路径）

```
Client            HTTP/SSE             agent(session)                 tools        store
  │ POST /conversations/:id/messages {"text":"环绕沧海校区半径200米高120拍照"}
  │──SSE──►        │ validate body │
  │                 │──► Agent.prompt(text) ──► pi loop
  │                 │       ◄──toolcall generate_route(intent)── LLM
  │                 │       ├─ validateToolArguments  → 通过
  │                 │       ├─ mergeDefaults → intent.merge
  │                 │       ├─ geometry.orbitWaypoints
  │                 │       ├─ airline.buildAirlineContent
  │                 │       ├─ airline.validateAirlineContent → ok
  │                 │       ├─ store.routes.create(route)  (status=draft, aiGenerated=true)
  │                 │       └─ return {routeId, intent, content}  → toolResult 回灌 LLM
  │                 │ ◄── LLM 生成总结文本 ── Agent 事件流
  │ ◄──SSE── text_delta* → route_generated{routeId, content, aiGenerated} → done
  │ 地图渲染 + 状态栏显示"已生成，可提交 GBH"
```

### 4.2 澄清循环（缺参路径）

```
  Agent.prompt("给我来一条环绕航线")
  ├─ LLM 调 generate_route({center…, shape:'orbit'})  （缺 radius/height/speed/actions）
  ├─ validateToolArguments → MissingIntentParamsError{missing:['radiusM','heightM','speedMps','actions']}
  ├─ throw → pi 编码 isError toolResult 回灌 LLM
  └─ LLM 依 system prompt 反问（一次只问一项）→ text_delta 输出"请告诉我环绕半径？"
  用户补充 → 下一轮 → 参数齐 → 生成（§4.1）
```

### 4.3 降级路径（LLM 不可用）

```
  Agent.prompt(...) → pi 流 error 事件 / stopReason=error（provider/网络失败）
  ├─ agent 编排层捕获 → fallback.parseIntent(text) → Intent（缺参则返回确定性问题文案）
  ├─ 走同一几何/构建/校验/落库链路，aiGenerated=false
  └─ SSE: text_delta(提示"当前为非 AI 生成") → route_generated{..., aiGenerated:false} → done
```

### 4.4 提交 GBH 与续编

```
  POST /api/routes/:id/submit-gbh ──► gbh.submitRoute(content)
      201 → store.routes.update(status='validated', gbhRouteId) → 返回 {status:'ok', gbhRouteId}
      400 → 返回 {status:'invalid', errors}（平台侧校验错误原样透传前端展示）
      5xx/超时 → {status:'error', message}

  GET /api/routes ──► 列表
  GET /api/routes/:id ──► 详情（content/intent/gbh 状态）→ 前端渲染地图 + 对话历史（加载续编）
  POST /api/conversations/:id/messages → 继续对话（agent 状态从 conversations.messages_json 恢复）
```

## 5. Server 模块设计

模块划分原则（flow-design）：Interface 小而完整、复杂性留在内部（Depth）、只引入有真实替换需求的 Seam、调用者与测试走同一 Seam。

```
                    ┌──────────────────────────────────────────┐
                    │  http（薄层，Hono）                        │
                    │  Interface: REST + SSE 事件流              │
                    └──────────────┬───────────────────────────┘
                                   │ 领域事件（shared/events）
┌──────────────┬───────────────────┼──────────────────────┬──────────────┐
│              │                   ▼                      │              │
│   agent（深度）                    │                     │              │
│   Interface: session API         │                     │              │
│   createSession/restoreSession/  │                     │              │
│   runTurn(convId,text)→事件流    │                     │              │
│              │                   │                     │              │
│   ┌──────────┴─────────┐         │                     │              │
│   │ tools: generate_route       │                     │              │
│   │ session: pi Agent 封装      │                     │              │
│   └──────────┬─────────┘         │                     │              │
│              │                   │                     │              │
├──────────────┼──────────────┬────┴───────┬─────────────┼──────────────┤
│   intent     │              │ geometry   │   airline   │   store      │
│   (schema/   │              │ (orbit)    │ (builder+   │   (routes+   │
│    merge/    │              │  纯函数     │  validator) │   conversations)
│    fallback) │              │            │             │              │
└──────────────┼──────────────┼────────────┼─────────────┼──────────────┘
               └──────────────┼────────────┼─────────────┴──┬───────────
                              │            │                │
                              ▼            ▼                ▼
                        gbh（Adapter）   AirlineContent 契约（shared）
                              │            │                │
                              ▼            │                ▼
                        GBH 模拟平台（外部）            SQLite（bun:sqlite）
```

### 5.1 Module: `config`

- **Interface**：`loadConfig(env): AppConfig`——返回解析后的配置对象；缺失/非法环境变量在启动时报错退出。
- **AppConfig**：`{ dbPath, gbhBaseUrl, deepseek: { baseUrl, apiKey, model }, tiandituToken, llmFallbackEnabled, heightLimitM, ... }`。
- **Implementation**：读 `process.env`，逐字段解析，集中在单一位置；校验常量（高度上限等）也归入配置。
- **Depth**：小 Interface，把"环境变量散落各处"的复杂性收拢。
- **Seam**：`loadConfig(env)` 直接传对象测试，无需真实进程环境。

### 5.2 Module: `store`

- **Interface**（两个 Repository，SQL 全部内部私有）：
  - `RouteRepository`：`create(route) → Route`、`list() → RouteSummary[]`、`get(id) → Route | null`、`update(id, patch) → Route`。
  - `ConversationRepository`：`create(conv) → Conversation`、`get(id) → Conversation | null`、`updateState(id, messagesJson, routeId) → void`、`findByRoute(routeId) → Conversation | null`。
- **Route**：`{ id, name, intent, content, aiGenerated, status, gbhRouteId?, gbhError?, createdAt, updatedAt }`（content 为 AirlineContent 对象，落库时 JSON 序列化）。
- **Conversation**：`{ id, messagesJson, routeId?, createdAt, updatedAt }`。
- **Implementation**：`bun:sqlite`，启动时执行 DDL（§10）；所有写走 prepared statement；JSON 字段序列化/反序列化在 Repository 内部完成（外部只见对象）。
- **Depth**：调用方只见对象 CRUD，SQLite 方言/JSON 编码细节全部在内部。
- **Adapter / Seam**：`db.ts` 持有 `Database` 实例，构造时注入（真实库或 `:memory:`）。测试用内存库——这是唯一的真实替换需求（测试 vs 生产），不为此引入接口抽象，仅构造注入。

### 5.3 Module: `intent`

- **Interface**：
  - `intentSchema: TSchema`（TypeBox，供 pi-ai 校验 tool call 参数）。
  - `requiredIntentParams: string[]`（缺参检测清单）。
  - `mergeIntent(partial, draft?): Intent`（非 undefined 字段覆盖，其余保留——多轮补充不丢失已有字段）。
  - `applyDefaults(intent): Intent`（count/rthAltitudeM/name 等默认值）。
- **Implementation**：TypeBox 定义 schema（§6）；merge 为纯函数。
- **Depth**：把"哪个字段必填、缺了怎么补、默认值从哪来"全部收进模块，LLM 与 http 层不感知。
- **Seam**：`validateIntentParams(partial)` 纯函数返回 `{ ok: true } | { ok: false, missing: string[] }`——这是多轮澄清的关键 Test Seam。

### 5.4 Module: `geometry`

- **Interface**：`orbitWaypoints({ center: {lat,lng}, radiusM, count }): GeoPoint[]`，其中 `GeoPoint = { lat, lng }`。
- **Implementation**：以 center 为圆心、radiusM 为半径均匀生成 count 个航点；简化球面换算 `111000 m/deg`（纬度每度 111km，经度按 `cos(lat)` 缩放），与参考实现算法一致；`count >= 3` 才成环，输入 `count < 3` 抛参数错误。
- **Depth**：纯函数、零依赖、零副作用，Interface 即全部。
- **Seam**：直接调函数断言输出航点数/半径误差/角间距。

### 5.5 Module: `airline`

- **Interface**：
  - `buildAirlineContent(intent): AirlineContent`——Intent → 对齐 open-api 契约的 AirlineContent。
  - `validateAirlineContent(content): ValidationResult`，`ValidationResult = { ok: true } | { ok: false, errors: { path, message }[] }`。
- **Implementation**：builder 按 §7 规则做字段映射（takeoff/waypoints/全局参数/动作挂载）；validator 按白名单与范围校验（机型枚举/坐标范围/高度上限/速度范围/动作参数合法性），错误带字段路径，直接供 agent 定位引导。
- **Depth**：open-api 契约的所有细节（默认值、枚举、字段语义）只出现在本模块；LLM/agent/http 都不需要知道"global_height 默认 120"这类事实。
- **Seam**：两个纯函数——单测断言构建结果对齐契约、校验拒绝非法输入且错误可定位到字段。

### 5.6 Module: `gbh`

- **Interface**：`submitRoute(content): Promise<SubmitResult>`，`SubmitResult = { status:'ok', routeId } | { status:'invalid', errors } | { status:'error', message }`（不 throw，错误编码进结果——对齐 pi "错误编码进流"哲学）。
- **Implementation**：POST `{gbhBaseUrl}/api/open/routes`，处理 201/400/5xx、超时（AbortSignal.timeout）；401 未鉴权按平台文档不存在鉴权，5xx 返回 `status:'error'`。
- **Adapter / Seam**：`submitRoute` 接受注入的 `fetch`（默认全局 fetch）；测试注入 stub。这是真实替换需求（外部服务在单测中不可达），注入点是公共行为边界而非实现细节。
- **Depth**：HTTP 细节（超时/状态码/错误格式）全部在内部。

### 5.7 Module: `agent`（深度 Module，核心）

- **Interface（Session API）**：
  - `createSession(): SessionHandle`。
  - `restoreSession(messagesJson, routeId?): SessionHandle`。
  - `runTurn(handle, userText, onEvent): Promise<void>`——`onEvent` 收到 `AgentEvent`（对齐 shared/events.ts：`text_delta` / `clarification` / `route_generated` / `error` / `done`）。
  - `serializeState(handle): string`——当前会话纯 JSON（供 store 落库/恢复）。
- **Implementation**：
  - 封装 `@earendil-works/pi-agent-core` 的 `Agent` 类；system prompt 定义领域角色、澄清协议（"一次只问一个缺失项"）、生成协议（"参数齐备后才调 generate_route"）。
  - 唯一核心 tool：`generate_route`（§6）。tool 的 execute 内：参数校验（缺参 throw `MissingIntentParamsError`）→ merge → geometry → airline 构建/校验（失败 throw `AirlineValidationError`）→ 落库 route → 返回结构化结果回灌 LLM。
  - `runTurn` 把 pi 事件流（`text_delta`/`done`/`error`）转发为 `AgentEvent`，并在 generate_route 成功时发出 `route_generated`。
  - 降级：捕获 LLM 失败（流 `error` 事件或 `stopReason === 'error'`）→ 调 `intent/fallback` → 走同一链路 → `aiGenerated:false`。
- **Adapter / Seam**：LLM 调用方通过构造注入（pi 的 provider/streamFn 注入方式在实现首任务 spike 确认，见 §13）。集成测试注入**假 LLM**（脚本化工具调用序列），断言 `onEvent` 事件序列——这是 agent 行为的公共观察点。
- **Depth**：pi 的 loop/事件/序列化细节、LLM 失败识别、澄清协议全部封装在内部；http 层只消费 Session API 与事件流。

### 5.8 Module: `http`

- **Interface**：Hono 实例 `app`（REST + SSE 端点，§9）。
- **Implementation**：路由薄层——请求体 JSON 校验、调用 Session API、把 `AgentEvent` 写入 SSE 响应、状态码/错误响应映射。
- **Depth**：不承载业务逻辑；业务规则全部在 agent/intent/airline/store 中。
- **Seam**：`app.request()` 免端口直调（Bun 内建 fetch），契约测试不依赖网络监听。

## 6. 意图 schema 与多轮澄清设计

### 6.1 Intent 类型（`shared/src/intent.ts` + `server/src/intent/schema.ts`）

```ts
interface GeoPoint { lat: number; lng: number }

interface RouteAction {                       // MVP 动作最小集
  type: 'takePhoto' | 'hover' | 'record'      // record = startRecord+stopRecord 对
  // hover: { seconds?: number } 默认 5
  // takePhoto/record: 默认 payload_lens_index 'wide'
}

interface Intent {
  name?: string                    // 可选，默认自动生成
  region: string                   // required；默认 '沧海校区'
  shape: 'orbit'                   // required；MVP 固定枚举
  center: GeoPoint                 // required；默认机巢锚点 22.531635, 113.935066
  radiusM: number                  // required；环绕半径（米）
  count: number                    // optional；航点数，默认 8
  heightM: number                  // required；高度（米）
  speedMps: number                 // required；速度（m/s）
  actions: RouteAction[]           // required，可为空数组（明确"无动作"）
  gimbalPitchDeg?: number          // optional；云台俯仰角，默认 -90（垂直下视）
  rthAltitudeM?: number            // optional；返航高度，默认 100
}
```

**required 集合**：`['region', 'shape', 'center', 'radiusM', 'heightM', 'speedMps', 'actions']`。

设计依据（PRD §5.4 明确"缺关键参数（区域/高度/速度/动作）时反问补齐"）：
- `radiusM` 是环绕几何的必需输入，缺失无法生成 → required。
- `heightM`/`speedMps` 虽有契约默认值（120/15），但 PRD 明确列为关键参数 → required（契约默认值只作校验后填充的兜底，不豁免澄清）。
- `actions` required 但**允许空数组**——用户说"就环绕一圈不动作"是合法需求；若用户完全没提动作，LLM 提取为空 → 触发反问"需要哪些动作？"。
- `count`/`rthAltitudeM`/`gimbalPitchDeg` 有合理默认值且非演示关键 → optional，用 `applyDefaults` 填充，不追问（减少提问轮次）。

### 6.2 多轮澄清实现路径（推荐：拦截式校验）

对比 pi 调研给出的两条成熟路径（`pi-agent-toolkit.md` §3.4）：

| 维度 | 方案 X：`ask_clarification` 工具 | **方案 Y：generate_route 参数校验拦截（采用）** |
|---|---|---|
| 定义面 | 需额外定义一个工具 + 双通道（澄清 vs 生成）协调 | 只有 `generate_route` 一个工具，schema 即校验源 |
| 流程确定性 | LLM 自行判断"该调用澄清还是生成"，可能误调/漏调 | 缺参**必然**被 schema 校验拦截，流程强制 |
| 缺参来源 | LLM 自由生成问题，内容不可控 | 缺失字段列表由 `validateIntentParams` 确定性输出 |
| 追问节奏 | 依赖 prompt 约束 | "一次只问一项"由 prompt + 确定性缺失列表共同保证，可单测断言 |
| 错误哲学 | 与 pi "错误编码进流"一致（返回 isError toolResult） | 相同——throw 被 pi 编码为 isError toolResult 回灌 LLM |
| 实现量 | 多一个 tool + prompt 编排 | 少一个 tool，校验复用 TypeBox `validateToolArguments` |

**结论：方案 Y。** 流程：LLM 在参数不齐时调用 `generate_route` → `validateIntentParams` 返回 `missing[]` → tool throw `MissingIntentParamsError({ missing })` → pi 将其编码为 `isError: true` 的 toolResult 回灌 LLM → LLM 读错误后在回复中反问用户（system prompt 规定"每次只追问一项缺失参数"）。用户补充 → 下一轮继续；参数齐备后 `generate_route` 正常执行生成。

**降级模式**下（LLM 不可用），缺参追问由 `fallback.parseIntent` 的确定性文案承担（§8），不再依赖 LLM 组织语言。

## 7. AirlineContent 构建与校验规则

### 7.1 构建规则（`airline/builder.ts`）

从 Intent 映射到 open-api 契约（对齐 `tech-stack-selection.md` §2.2/§2.3）：

| AirlineContent 字段 | 来源 |
|---|---|
| `name` | intent.name 或自动生成（如 `"沧海校区-环绕-<timestamp>"`） |
| `aircraft_model` | `'M350'`（默认，配置常量，对齐参考实现） |
| `takeoff` | `{ lat: center.lat, lng: center.lng, altitude: 0 }` |
| `waypoints` | `geometry.orbitWaypoints(...)` 逐点映射：`altitude: heightM`、`speed: speedMps`、`heading_mode: 'fixed'`、`heading_angle: 0`、`turn_mode: 'clockwise'` |
| `global_height` | `120`（契约默认） |
| `global_speed` | `15`（契约默认） |
| `finish_action` | `'goHome'` |
| `rth_altitude` | `rthAltitudeM ?? 100` |
| `takeoff_security_height` | `50` |
| `exit_on_rc_lost` | `'goContinue'` |
| `altitude_mode` | `'relativeToStartPoint'` |
| waypoints[].`actions` | 动作挂载：`takePhoto`/`hover` 挂首航点；`record` 拆为 `startRecord`（首航点）+ `stopRecord`（末航点）；`gimbalPitchDeg` → `gimbalRotate` 挂首航点（`pitch_angle`） |

**假设标注**：`heading_mode: 'fixed' + turn_mode: 'clockwise'` 是 MVP 简化语义（环绕方向固定顺时针）；若演示要求逆时针或朝向圆心，仅改此映射常量即可，不动模块结构（§13）。

### 7.2 校验规则（`airline/validator.ts`）

- `aircraft_model` ∈ 14 种枚举白名单（M30/M30T/M350/M3E/M3T/M3M/M3TA/M3D/M3TD/M4E/M4T/M4D/M4TD/M400）。
- `takeoff`、每个 waypoint 的 `lat ∈ [-90, 90]`、`lng ∈ [-180, 180]`。
- `waypoints` 非空且 `length >= 3`。
- 每个 waypoint 的 `altitude ∈ [0, config.heightLimitM]`（默认 500，配置常量）。
- `speed ∈ [1, 30]`（m/s，配置常量；契约无明确上限，取保守值）。
- `finish_action` / `exit_on_rc_lost` / `altitude_mode` / `heading_mode` / `turn_mode` ∈ 各自枚举。
- `actions[].action_type` ∈ 动作白名单；`action_params` 键与动作类型匹配（如 `hover` 的 `hover_time`、`takePhoto` 的 `payload_lens_index`）。
- 返回 `{ ok:false, errors:[{path, message}] }`——errors 直接作为 agent 引导输入（"校验失败：第 3 个航点 altitude 超上限 500m"）。

## 8. 降级策略

**触发条件**：pi 流 `error` 事件 / `stopReason === 'error'`（Key 失效、网络失败、超时）且 `config.llmFallbackEnabled`（默认 true）。

**流程**（agent 模块内部）：
1. 捕获 LLM 失败 → 调 `intent/fallback.parseIntent(text)`：关键词规则解析（区域/高度/速度/动作/半径关键词 → Partial Intent）。
2. 若缺必填参数 → 直接返回确定性澄清文案（"当前为非 AI 生成模式，请提供：环绕半径（米）"），不发 route 事件。
3. 参数齐备 → 走与 LLM 路径完全相同的 geometry → airline → store 链路，`aiGenerated: false` 落库。
4. 事件流：先输出 `text_delta`（"当前为非 AI 生成，规则引擎生成"），再 `route_generated{aiGenerated: false}`。

**标注**：`aiGenerated` 字段贯穿 route 落库 → 历史列表 → 前端 RouteCard/地图标注位（"非 AI 生成"徽标），保证演示真实性不降级（PRD §5.8）。

**fallback 规则示例**（`intent/fallback.ts`，可测纯函数）：
- `"环绕|绕|转圈"` → `shape: 'orbit'`
- `"沧海|校区"` → `region: '沧海校区', center: 机巢锚点`
- `"半径\s*(\d+)"` → `radiusM`
- `"高\s*(\d+)"` / `"(\d+)米"` → `heightM`
- `"拍|拍照"` → `actions: ['takePhoto']`；`"悬停"` → `actions: ['hover']`；`"录像|录制"` → `actions: ['record']`
- 无法识别且缺关键参数 → 确定性缺参文案

## 9. API 契约

### 9.1 REST 端点

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| POST | `/api/conversations` | `{}` | `201 { conversationId }` |
| POST | `/api/conversations/:id/messages` | `{ "text": string }` | `200` **SSE 事件流**（见 §9.2） |
| GET | `/api/conversations/:id` | — | `200 Conversation { id, routeId?, messages: AgentMessage[] }` |
| GET | `/api/routes` | — | `200 RouteSummary[]`（id/name/status/aiGenerated/waypointCount/createdAt） |
| GET | `/api/routes/:id` | — | `200 RouteDetail { content, intent, aiGenerated, status, gbhRouteId?, gbhError? }`；404 |
| POST | `/api/routes/:id/submit-gbh` | `{}` | `200 { status:'ok', gbhRouteId }` 或 `{ status:'invalid', errors }` 或 `{ status:'error', message }` |
| GET | `/api/map-token` | — | `200 { token }`（服务端下发，前端不接触环境变量） |

错误统一形如 `{ "error": { "code", "message" } }`；404/400/500 语义见各端点。

### 9.2 SSE 事件契约（`shared/src/events.ts`，对齐 pi AssistantMessageEvent 命名 + 领域事件）

| 事件类型 | 载荷 | 语义 |
|---|---|---|
| `text_delta` | `{ type, text: string }` | 流式回复增量（转发 pi `text_delta`），前端打字机 |
| `clarification` | `{ type, missing: string[], text?: string }` | agent 反问缺参（降级模式必有 text；LLM 模式经 text_delta 表达） |
| `route_generated` | `{ type, routeId: string, content: AirlineContent, aiGenerated: boolean }` | 生成完成，前端渲染地图 |
| `error` | `{ type, code: string, message: string }` | 本轮失败（非降级态），前端错误提示 |
| `done` | `{ type, usage?: { inputTokens, outputTokens } }` | 本轮结束 |

**传输方式**：`POST /api/conversations/:id/messages` 的响应体即 `text/event-stream`（`data: <json>` 行），前端用 `fetch` + `ReadableStream` 逐事件解析（不走 EventSource——需要 POST 且事件类型多样）。连接中断 = 本轮失败，用户可重发。

### 9.3 事件流时序示例（成功生成）

```
event: text_delta    data: {"type":"text_delta","text":"正在生成环绕航线"}
event: text_delta    data: {"type":"text_delta","text":"，请稍候…"}
event: route_generated data: {"type":"route_generated","routeId":"r_01","content":{...},"aiGenerated":true}
event: text_delta    data: {"type":"text_delta","text":"已生成，可提交 GBH 验证"}
event: done          data: {"type":"done"}
```

## 10. 数据模型（`store/db.ts` DDL）

```sql
CREATE TABLE IF NOT EXISTS routes (
  id            TEXT PRIMARY KEY,              -- uuid
  name          TEXT NOT NULL,
  intent_json   TEXT NOT NULL,                 -- Intent JSON
  content_json  TEXT NOT NULL,                 -- AirlineContent JSON（单一权威）
  ai_generated  INTEGER NOT NULL DEFAULT 1,    -- 0/1 降级标注
  status        TEXT NOT NULL DEFAULT 'draft', -- draft|validated|failed
  gbh_route_id  TEXT,
  gbh_error     TEXT,
  created_at    TEXT NOT NULL,                 -- ISO8601
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,              -- uuid
  messages_json TEXT NOT NULL,                 -- pi Agent 状态纯 JSON（消息累积+工具结果）
  route_id      TEXT,                          -- 当前聚焦航线（可空），加载续编入口
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_routes_created_at ON routes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_route ON conversations(route_id);
```

- `content_json` 是航线数据的**单一权威**（构造/校验/GBH 提交/地图渲染全用它）；`intent_json` 只用于加载续编时的上下文回填。
- `conversations.messages_json` 存 pi Agent 序列化状态（纯 JSON，`agent/session.ts` 的 `serializeState` 产物）；恢复即 `restoreSession(messagesJson)`，无状态重建成本。

## 11. 前端设计

- **状态**（`state/`）：`useReducer` + Context，三个 slice——`conversation`（消息列表 + 流式追加）、`currentRoute`（AirlineContent + aiGenerated + 提交状态）、`history`（RouteSummary[]）。
- **流式读取**（`api/useChatStream.ts`）：POST 后按 `data:` 行解析事件 → dispatch；`text_delta` 追加文本、`route_generated` 更新地图 + 状态栏、`error` 显示错误条。
- **`RouteMap.tsx`**：原生 Cesium viewer 薄壳——useEffect 创建/销毁 viewer、负责图层（天地图 WMTS `WebMapTileServiceImageryProvider`，token 来自 `GET /api/map-token`）与相机视角；**不包含业务换算**。
- **`lib/cesium-entities.ts`**：`buildCesiumEntities(content): CesiumEntityDescription[]` 纯函数（机巢标记/航点/连线/`aiGenerated` 徽标数据）——Cesium 渲染业务与 viewer 生命周期分离，业务可单测。
- **`HistoryPanel.tsx`**：列表 + "加载续编"（跳转会话并回填对话历史与地图）+ "再次提交 GBH"。
- **底图回退**：天地图加载失败/软渲染环境 → 可配置回退 Esri World Imagery（PRD Open Question，前端做成可切换配置）。

### 11.1 交互与视觉设计（UI Design）

> 面向"领导现场演示 + 内部规划员日常"双重场景。目标：**10 分钟内从对话到 GBH 验证通过**，演示过程可信、结果可读。

#### 11.1.1 页面布局（左对话 / 右地图，全屏）

```
┌──────────────────────────────────────────────────────────────┐
│  Header: 产品名「航线编辑 Agent」 · 状态徽标(LLM在线/降级) · 新建会话  │
├───────────────┬──────────────────────────────────────────────┤
│  对话面板(420px) │             地图区域(flex:1)                    │
│  ┌───────────┐ │  ┌──────────────────────────────────────────┐ │
│  │ 建议话术区  │ │  │   Cesium Viewer (天地图底图)                │ │
│  │ (首屏展示)  │ │  │   · 机巢标记(锚点)                          │ │
│  │ 消息列表    │ │  │   · 航线 polyline + 航点 label             │ │
│  │ (气泡流式)  │ │  │   · aiGenerated 徽标浮层                   │ │
│  │ 解析详情    │ │  │   · 航线信息浮层(名称/航点/高度/速度/动作)    │ │
│  └───────────┘ │  └──────────────────────────────────────────┘ │
│  输入框+发送    │  │  底部操作条: [一键提交 GBH] [提交状态]        │ │
├───────────────┴─┼──────────────────────────────────────────────┤
│  HistoryPanel(左下方可收起): 历史航线列表 + 加载续编 + 再次提交 GBH │
└──────────────────────────────────────────────────────────────┘
```

- **左对话固定 420px**（可拖动调宽），右地图弹性；`height: 100vh`，整体无页面滚动（内部滚动在消息列表）。
- 布局层级与参考实现一致（左对话 + 右地图），但增加**建议话术区**、**解析详情**、**GBH 状态条**与**历史面板**。

#### 11.1.2 对话流交互（核心流程）

1. **首屏**：空态展示 2–4 条建议话术（点击即发送，降低演示冷启动门槛）：
   - 「环绕沧海校区巡检一圈，高度 120 米」
   - 「以机巢为圆心半径 300 米，高度 100 米，每点拍照」
   - 「环绕沧海校区两圈，加录像和返航」
2. **发送消息** → 气泡进入消息列表，agent 回复以**打字机流式**出现（`text_delta`）。
3. **缺参追问**：agent 气泡给出追问（如"请指定飞行高度"），用户回复补充 → 循环直至生成。追问气泡带"待补充参数"标签，明确当前缺口。
4. **生成完成**：`route_generated` → 地图渲染航线 + 浮层显示信息 + 底部操作条激活"一键提交 GBH"。
5. **解析详情**：消息气泡可展开「解析详情」，展示 LLM 提取的 Intent JSON（region/shape/center/radiusM/heightM/speedMps/actions）——**演示真实 LLM 生成的核心证据**，也是降级态与正常态的区分展示。
6. **错误引导**：生成失败 → 错误条定位到字段（如"高度 700m 超出上限 500m，请调整高度"），不伪装成功。
7. **降级标注**：LLM 不可用时 route 卡片与地图徽标显示「非 AI 生成」（`aiGenerated:false`），保持演示真实性不降级。

#### 11.1.3 视觉基调

- **整体**：深色科技风（适合投影/大屏演示），主色 `#0b1220` 深空蓝底 + 高亮青蓝 `#38bdf8`（航线/交互元素）+ 语义色（成功绿 `#34d399` / 警告琥珀 `#fbbf24` / 错误红 `#f87171`）。
- **对话面板**：半透明深底 `rgba(15,23,42,0.92)`，用户气泡高亮描边，agent 气泡中性。
- **地图元素**：
  - 机巢：青色圆点 + 标签「机巢」；
  - 航线：`#38bdf8` 高亮 polyline，线宽 3px；
  - 航点：白色圆点 + 序号 label + 航向/动作图标（拍照📷/悬停⏸/录像⏺ 用文本图标，避免 emoji 依赖字体）；
  - 拍照点：航点旁小相机图标；悬停：暂停图标；返航：HOME 图标。
  - 信息浮层：半透明深底卡片，白色文字（参考实现已验证此样式在 Cesium 上可读）。
- **字体**：系统字体栈，等宽字用于 Intent JSON 详情（`ui-monospace`）。

#### 11.1.4 状态与反馈设计

| 场景 | 反馈 |
|------|------|
| agent 思考中 | 气泡内打字光标动画 + 「正在理解需求…」文案 |
| 缺参追问 | 追问气泡 + 顶部「待补充：高度」胶囊标签 |
| 生成中 | 地图区域 loading 遮罩 + 「正在生成航线…」 |
| GBH 提交中 | 底部按钮 loading + 文案「正在提交模拟飞行…」 |
| GBH 成功 | 按钮变绿「验证通过」+ 浮层显示平台返回 routeId |
| GBH 失败 | 按钮变红 + 错误条显示平台错误信息（原样透传） |

#### 11.1.5 可访问性与演示稳健性

- 地图/对话均支持键盘操作（聚焦/滚动），气泡文本可选中复制（演示时方便展示参数）。
- 天地图软渲染失败 → 回退 Esri 底图（配置项），保证演示环境必出图。
- 全屏布局适配 1366×768 最低分辨率（会议室投影常见），左面板与操作条不挤压地图。
- 建议话术点击即发（演示防呆），会话异常可「新建会话」重置。

#### 11.1.6 UI 设计约束与 Testing 衔接

- UI 设计仅定义**信息架构、交互流与视觉基调**，不产出逐像素高保真；组件实现遵循 §11 技术设计（`buildCesiumEntities` 纯函数、`useChatStream` hook、组件边界）。
- 交互可测点已落入 Testing Decisions：§12.10（前端流式渲染）、§12.11（AirlineContent→Cesium 实体）、§12.12（历史列表与续编）。UI 视觉层不单测，由 review 阶段人工验收对照本设计。

## 12. Testing Decisions

测试命令：`npm test`（server：`bun test`；frontend：`vitest run`）。Test Level 用"最窄有效层级"。

### 12.1 Orbit 环绕几何生成

- Test Seam: `geometry.orbitWaypoints({center, radiusM, count})` 纯函数
- Observable Result: 返回恰为 `count` 个航点；任取航点与 center 的球面距离 ≈ radiusM（`111000 m/deg` 换算，容差 ±radiusM×0.5%）；相邻航点角间距 = `360/count` 度；`count < 3` 抛参数错误
- Test Level: server 单元测试

### 12.2 AirlineContent 构建对齐契约

- Test Seam: `airline.buildAirlineContent(intent)` 纯函数
- Observable Result: 顶层字段按 §7.1 映射（takeoff=center、全局参数默认值、waypoints 数量=count、动作挂载位置：takePhoto/hover 在首航点、startRecord 首/stopRecord 末、gimbalRotate 在首航点）；无多余/缺漏字段
- Test Level: server 单元测试

### 12.3 AirlineContent 校验规则

- Test Seam: `airline.validateAirlineContent(content)` 纯函数
- Observable Result: 非法机型/越界坐标（lat=91）/超上限高度（>500m）/非法速度（>30m/s）/非法动作参数 → `{ ok:false, errors[] }` 且错误带字段路径；合法输入 → `{ ok:true }`
- Test Level: server 单元测试

### 12.4 意图缺参检测与澄清触发

- Test Seam: `intent.validateIntentParams(partial)` + `agent/runTurn` 事件流（注入假 LLM）
- Observable Result: 缺必填字段 → 返回 `{ ok:false, missing:['radiusM','heightM',...] }`；agent 流中 tool 抛错被编码为 isError toolResult 回灌；假 LLM 依据 missing 输出追问 → 下一轮补参 → 流出现 `route_generated`
- Test Level: server 单元测试（validateIntentParams）+ server 集成测试（agent 编排，假 LLM）

### 12.5 多轮补充不丢已有参数（merge）

- Test Seam: `intent.mergeIntent(partial, draft)` 纯函数
- Observable Result: 补充单字段后既有字段保留（如先给 center 后补 heightM，center 不被覆盖）；未提供字段保持 undefined（等待后续补充）
- Test Level: server 单元测试

### 12.6 降级策略（LLM 不可用 → 规则兜底 + 标注）

- Test Seam: `intent/fallback.parseIntent(text)` 纯函数 + agent 集成（假 LLM 注入失败）
- Observable Result: `parseIntent("环绕沧海半径200米高120拍照")` → 完整 Intent（shape='orbit'、center=机巢锚点、radiusM=200、heightM=120、actions=['takePhoto']）；LLM 失败时 `runTurn` 流出现 `route_generated{aiGenerated:false}` 且落库 `ai_generated=0`；缺参时返回确定性澄清文案
- Test Level: server 单元测试 + server 集成测试

### 12.7 GBH 提交客户端

- Test Seam: `gbh.submitRoute(content)`（注入 stub fetch）
- Observable Result: 201 → `{status:'ok', routeId}`；400 → `{status:'invalid', errors}`；500/超时 → `{status:'error', message}`（不 throw）
- Test Level: server 集成测试（stub fetch）；可选真实集成：`GBH_BASE_URL` 指向真实平台 + 环境变量开关（PRD §10 待实测）

### 12.8 路由与会话落库/恢复

- Test Seam: `store` 的 RouteRepository/ConversationRepository（`:memory:` 库）
- Observable Result: create/list/get/update 全往返（含 unicode 中文 JSON 无损）；`serializeState → restoreSession` 后对话可继续（消息历史完整）；`findByRoute` 支持加载续编
- Test Level: server 集成测试

### 12.9 HTTP/SSE 契约

- Test Seam: Hono `app.request()` 免端口直调（注入假 agent 会话层）
- Observable Result: `POST /api/conversations/:id/messages` 响应为 SSE 流且事件序列合法（text_delta→route_generated→done）；`GET /api/routes` 返回列表结构；404/错误状态码与错误体格式
- Test Level: server 集成测试

### 12.10 前端流式渲染

- Test Seam: `api/useChatStream` hook + ChatPanel（vitest + RTL，mock fetch 返回 SSE 流）
- Observable Result: 事件流驱动消息列表增量追加（打字机）、`route_generated` 触发 RouteCard 出现、`error` 触发错误条、`aiGenerated:false` 显示"非 AI 生成"标注
- Test Level: frontend 组件测试

### 12.11 AirlineContent → Cesium 实体

- Test Seam: `lib/buildCesiumEntities(content)` 纯函数
- Observable Result: 输入 AirlineContent → 输出机巢标记 + N 个航点实体 + 闭合连线（首尾相连）的实体描述数组；`aiGenerated` 影响徽标描述
- Test Level: frontend 单元测试（不触碰真实 Cesium viewer）

### 12.12 历史列表与加载续编

- Test Seam: `GET /api/routes` + `GET /api/conversations/:id`（server 集成）+ HistoryPanel（前端组件）
- Observable Result: server 返回列表含 aiGenerated/status/waypointCount；续编加载后对话历史与地图航线完整回填、可继续 POST 消息
- Test Level: server 集成测试 + frontend 组件测试

## 13. 假设与不确定项（Open Questions）

| # | 事项 | 状态/处置 |
|---|---|---|
| 1 | pi `Agent` 类的 LLM 注入方式（构造参数/provider/streamFn）与 `beforeToolCall` 钩子的精确暴露（0.x 快速演进期，API 可能变化） | 实现首任务做 **spike**：以最小 pi Agent + DeepSeek 真实调用验证流式事件/tool 分发/错误编码；若 `beforeToolCall` 未暴露则用"execute 内校验 + throw"（本方案已兼容此路径） |
| 2 | `Agent` 状态序列化/恢复的精确 API（messages 注入方式） | spike 一并确认；本方案以"纯 JSON 序列化 + 构造注入"为目标接口，若 API 不支持注入则退化为"重放消息" |
| 3 | GBH 平台地址端口不一致（8085/5175/8081 三处，`tech-stack-selection.md` §2.4） | `GBH_BASE_URL` 环境变量 + 启动健康检查（最小 payload POST）；需现场实测确认 |
| 4 | 天地图软渲染失败（先行实现记录）与 token 管理 | 底图可配置回退 Esri；token 服务端下发 `GET /api/map-token`；PRD Open Question 保留 |
| 5 | Bun 与 pi 包的兼容细粒度（官方佐证：coding-agent 用 `bun build --compile`） | 回退路径 Node 24（pi `engines >= 22.19`）；driver 差异被 Store Module 封装 |
| 6 | DeepSeek 具体模型名（`deepseek-chat` vs 其他） | `config` 环境变量 `DEEPSEEK_MODEL`，不硬编码 |
| 7 | 校验常量（高度上限 500m、速度上限 30m/s） | 配置常量，非硬编码；契约无权威上限，取保守值 |
| 8 | 环绕语义 `heading_mode:'fixed' + turn_mode:'clockwise'` | MVP 简化，常量配置，改动不触模块结构 |
| 9 | 生成校验失败后的"agent 定位错误字段引导改正"的 LLM 效果 | 校验 errors 带字段路径（确定性），LLM 只需转述；单测覆盖假 LLM 场景 |

## 14. 实施顺序建议（tracer-bullet 提示）

任务拆解见 flow-tasks；建议依赖方向（真实 blocking edge）：

1. **spike**：pi Agent 最小接入（DeepSeek 真实调用 + 事件流 + tool 校验 + 状态序列化/恢复）→ 消除 §13 #1/#2
2. **shared 契约** + server 骨架（config + Hono app + SQLite DDL + `:memory:` 测试基建）
3. **geometry orbit + airline builder/validator**（纯函数先行，同步单测）
4. **intent schema/merge/fallback** + 单测
5. **gbh client**（stub fetch 测试）
6. **store 完整实现**（routes/conversations CRUD + 序列化往返）
7. **agent 编排**（tools + Session API + 澄清 + 降级，假 LLM 集成测试）
8. **http + SSE 端点**（契约测试）
9. **前端**：api client/useChatStream → ChatPanel → RouteMap → HistoryPanel → 端到端
10. **演示验收**（Door check：对话 → 10 分钟出线 → GBH 通过）

*注：§6 中 Intent 的 required 集合、§7 动作挂载规则、§8 关键词示例为设计默认值，实现时以 PRD §5.4/§5.5 与领域契约为准，冲突时回查 `CONTEXT.md`。*
