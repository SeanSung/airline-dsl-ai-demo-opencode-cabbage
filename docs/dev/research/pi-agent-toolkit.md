# pi agent toolkit 核心实现调研（earendil-works/pi）

> 调研类型：本地代码调研（无网络搜索）
> 调研日期：2026-08-21
> 调研对象：`/tmp/opencode/pi/src`（pi monorepo，v0.84.2 快照，含 `pi.tar.gz`）
> 服务对象：大疆航线编辑 Agent 的 agent server 技术选型（参考/学习 pi 的基础实现）
> 结论性质：**事实 + 模式提炼 + 方案评估**；决策权在编排器/用户
> 关联文档：`docs/dev/research/tech-stack-selection.md`（技术栈选型，本调研为其 LLM 层与 agent 运行时决策提供纵深证据）

---

## 0. 结论摘要（TL;DR）

| 决策点 | 结论 |
|---|---|
| pi-ai 能否直接用 | 可以（npm 包 `@earendil-works/pi-ai`），但运行时要求 **Node ≥ 22.19.0**（`packages/ai/package.json:91-93`），核心层运行时中立（浏览器可用）；只能被 TS/JS 调用，**Go 无法直接调用** |
| pi 的 agent 运行时 | `@earendil-works/pi-agent-core` 是通用 agent runtime（agent loop + tool 分发 + 事件流 + 会话状态），核心 loop 无 Node 内置依赖；harness 层（文件系统/编辑工具）是 coding-agent 专属，与领域 agent 不匹配 |
| protocol/server/client | 存在但 **全部标注 experimental，无兼容性保证**（`packages/server/README.md:3`、`packages/protocol/README.md:69`），不推荐生产直接依赖 |
| **推荐方案** | **方案 B（Go 移植核心模式）** 为主选——单一语言栈、与 yuchen-smart-ops 融合无冲突、领域 agent 仅需 pi 模式中的 5 个核心抽象；方案 A（Node 全量引入）仅在"接受后端改 TS + 多 provider 免维护"时作为激进备选 |
| pi 最有借鉴价值的资产 | ①事件流协议（`AssistantMessageEvent`）②Provider 三层抽象 ③agent loop 双层循环 ④tool 生命周期事件 ⑤"错误编码进流而非 throw"哲学 |

---

## 1. 范围、版本与方法

- 版本快照：monorepo 各包版本 `0.84.2`（如 `packages/ai/package.json:3`），CHANGELOG 显示 `[0.84.2] - 2026-08-14`（`packages/ai/CHANGELOG.md:25`），且 `[Unreleased]` 段含多项 Breaking Changes（`packages/ai/CHANGELOG.md:3-8`）→ **API 处于快速演进期，0.x 无稳定性承诺**。
- 方法：逐文件阅读一手源码，所有结论带文件路径+行号；无外部来源；关键结论标注置信度。
- 范围：聚焦 `packages/ai`、`packages/agent`、`packages/protocol`、`packages/client`、`packages/server`、`packages/session-backends/sqlite-node`；`packages/coding-agent` 仅作组装参考。

---

## 2. packages/ai — 统一多 provider LLM API

### 2.1 架构设计：三层抽象

**第一层：API 实现（wire protocol 适配）** — `packages/ai/src/api/` 下每模块导出统一契约 `stream` / `streamSimple`（`packages/ai/src/types.ts:272-281` 的 `ProviderStreams` 接口）。已有 API 适配器：

| API id | 对应 provider 群 |
|---|---|
| `openai-completions` | xAI、Groq、Cerebras、OpenRouter、DeepSeek、Ollama/vLLM 等（`packages/ai/README.md:234`） |
| `openai-responses` | OpenAI、Azure OpenAI（`packages/ai/src/types.ts:17-27`） |
| `anthropic-messages` | Anthropic 及 Kimi For Coding 等 Anthropic 兼容端点（`packages/ai/README.md:87`） |
| `google-generative-ai` / `google-vertex` | Google / Vertex（`packages/ai/src/types.ts:22-23`） |
| `bedrock-converse-stream` | Amazon Bedrock（Node-only，`packages/ai/README.md:1397`） |
| `mistral-conversations`、`openai-codex-responses`、`azure-openai-responses`、`pi-messages` | 各自专属 |

**第二层：Provider（运行时单元）** — `Provider` 接口（`packages/ai/src/models.ts:97-149`）：持有 id/name/baseUrl、auth（`ProviderAuth`）、模型目录（`getModels()`）、以及 `stream`/`streamSimple` 行为。`createProvider()`（`packages/ai/src/models.ts:762-862`）从 parts 组装 provider，支持单 API 或按 `model.api` 分发的混合 API map（`models.ts:775-779`）。

**第三层：Models 集合（请求路由 + auth 解析）** — `Models` 接口（`packages/ai/src/models.ts:156-223`）：`getModel(provider, id)` 同步查找 → `stream/complete` 时经 `applyAuth`（`models.ts:636-665`）解析 provider auth 并合并 headers，再委派给拥有该模型的 provider。Credential 解析顺序：显式 apiKey > 存储 credential > 环境变量（`packages/ai/src/providers/anthropic.ts:18-39` 为范本）。

**核心消息模型**：`Context = { systemPrompt, messages, tools }`（`packages/ai/src/types.ts:521-525`）；消息三类 `user` / `assistant` / `toolResult`（`types.ts:467`）；`AssistantMessage` 含 `stopReason`、`usage`（含成本核算）、`errorMessage`（`types.ts:427-447`）。**Context 与 Model 均为纯 JSON 可序列化**（`packages/ai/README.md:1339-1370`）。

### 2.2 流式与 tool calling

- **流式**：所有请求统一返回 `AssistantMessageEventStream`（`types.ts:535-551` 定义事件联合类型；`packages/ai/src/utils/event-stream.ts:4-67` 实现 `EventStream`，`push/end/result()` 三方法 + async iterator）。事件含 `text_delta`、`thinking_delta`、`toolcall_delta`、`done`、`error`。
- **tool calling**：工具定义用 TypeBox schema（`types.ts:514-519`），`toolcall_delta` 携带渐进解析的 partial JSON 参数（`README.md:574-607`），`toolcall_end` 给出完整参数。参数校验函数 `validateToolCall` / `validateToolArguments`（`packages/ai/src/utils/validation.ts:302,317`）。
- **契约约束**：流函数"不 throw"，请求/模型/运行时失败编码进流（`types.ts:325-332`），最终消息 `stopReason` 为 `"error"`/`"aborted"` 且带 `errorMessage`（`README.md:897-919`）。abort 用 `AbortSignal`，可续聊（`README.md:955-978`）。

### 2.3 运行时要求（对 Go 集成的关键事实）

- `engines: node >= 22.19.0`（`packages/ai/package.json:91-93`）。**纯 TS/JS npm 包，Go 无法 require**。
- 核心代码几乎不 import `node:` 内置模块（仅 OAuth 回调、CLI、Bedrock/Codex 边角功能使用，且多数为 type-only 或懒加载）——grep `node:` 仅 7 处（`src/auth/oauth/openrouter.ts:14`、`src/auth/oauth/anthropic.ts:8`、`src/cli.ts:3-4`、`src/utils/pi-user-agent.ts:1`、`src/api/openai-codex-responses.ts:1`、`src/api/bedrock-converse-stream.ts:1`，前两处为 `import type` 或懒加载）。
- **支持浏览器**（`README.md:1374-1399`）：核心入口与 provider 工厂 side-effect free 可打包；浏览器需显式传 `apiKey` 或注入 localStorage 版 `CredentialStore`；OAuth 与 Bedrock 为 Node-only（懒加载，不进浏览器 bundle）。
- 依赖体积：直接依赖 10 个（`packages/ai/package.json:62-73`），含 `openai 6.40.0`、`@anthropic-ai/sdk 0.91.1`、`@google/genai 1.52.0`、`@aws-sdk/client-bedrock-runtime 3.1048.0`、`typebox 1.3.7` 等。**安装时全量落地，但运行时经 `./api/<id>.lazy` 懒加载**（`README.md:1413-1421`）——单 provider 场景实际只加载对应 SDK。
- 模型目录：内置 catalog 由脚本从 provider 官方目录生成（`scripts/generate-models.ts`，`package.json:51-55`），静态数据随包分发。

**置信度：高**（全部直接引用源码/README 行号）。

---

## 3. packages/agent — agent runtime（tool calling + state management）

### 3.1 Agent loop 核心实现

文件：`packages/agent/src/agent-loop.ts`。

- **入口**：`agentLoop(prompts, context, config, signal, streamFn)` 返回可迭代事件流（`agent-loop.ts:31-54`）；`agentLoopContinue` 从现有 context 续跑（重试用，`agent-loop.ts:64-93`）。
- **双层循环**（`runLoop`，`agent-loop.ts:155-275`）：
  - 内层 `while (hasMoreToolCalls || pendingMessages.length > 0)`：消息 → `streamAssistantResponse`（`agent-loop.ts:281-372`，此处 AgentMessage[] 经 `transformContext` → `convertToLlm` 转为 LLM Message[]）→ 提取 toolCall → 执行 → 结果回填 context → 下一轮。
  - 外层 `while (true)`：内层退出后轮询 `getFollowUpMessages`（steer/follow-up 队列）。
- **关键设计点**：
  - `streamAssistantResponse` 中 partial message 持续写回 `context.messages` 尾元素并 emit `message_update`（`agent-loop.ts:314-359`）→ UI 流式更新的单一数据源。
  - **stopReason == "length" 时所有 tool call 视为参数可能截断而全部 fail**（`agent-loop.ts:208-214`、`failToolCallsFromTruncatedMessage` `agent-loop.ts:381-406`）。
  - tool 执行支持 parallel（默认）与 sequential（`agent-loop.ts:411-426`、`executeToolCallsParallel` `agent-loop.ts:489-554`）；`beforeToolCall` 可拦截（`agent-loop.ts:636-647`），`afterToolCall` 可改写结果（`agent-loop.ts:724-751`）。
  - `prepareNextTurn` 钩子可在轮间换模型/换 thinking level（`agent-loop.ts:232-245`）。

### 3.2 Tool 注册与分发

- 定义：`AgentTool`（`packages/agent/src/types.ts:386-409`）= pi-ai 的 `Tool` + `label` + `execute(toolCallId, params, signal, onUpdate)`（**throw 表示失败**，`types.ts:394`）+ 可选 `prepareArguments`/`executionMode`。
- 分发：按 `toolCall.name` 在 `context.tools` 查找（`agent-loop.ts:607`）；未找到 → 错误结果回给 LLM（`agent-loop.ts:609-614`）；参数经 TypeBox 校验（`agent-loop.ts:618`）。
- 工具结果 `AgentToolResult` 可含 `content`（文本/图片）、`details`、`usage`、`addedToolNames`、`terminate`（`types.ts:361-375`）；`terminate: true` 批量生效时提前结束循环（`agent-loop.ts:582-584`）。
- 事件面：`tool_execution_start` / `tool_execution_update`（工具流式进度）/ `tool_execution_end`（`types.ts:441-443`）。

### 3.3 State / session 管理

- **`Agent` 类**（`packages/agent/src/agent.ts:173-592`）：持有可变状态 `systemPrompt/model/thinkingLevel/tools/messages` + 运行期 `isStreaming/streamingMessage/pendingToolCalls/errorMessage`（`types.ts:333-358`）；`prompt()`/`continue()`/`steer()`/`followUp()`/`abort()`/`reset()`；`subscribe()` 事件监听按注册序 await（`agent.ts:250-253`）。
- **多轮状态保持**：消息累积在 `agent.state.messages`（纯 JSON，可序列化）；`sessionId` 透传给 provider 做 prompt 缓存（`agent.ts:206`）；steering/follow-up 用双队列（`PendingMessageQueue`，`agent.ts:125-159`）支持运行中插入用户消息。
- **持久化**（可选）：`packages/agent/src/harness/session/` 提供**追加式日志模型**的 `Session`（seq 递增、parent 链、lane 分支、fork、标签；`session.ts:102-299`）+ 内存 `SessionState`（`state.ts:50-344`）；SQLite 后端在独立包 `@earendil-works/pi-session-backend-sqlite-node`（`packages/session-backends/sqlite-node/README.md:1-22`，`node:sqlite`，`engines: node >= 22.19.0`，`package.json:33-35`）。**注意：harness/session 层属于 coding-agent 场景的产物，领域 agent 可只用 `Agent` 类 + 自管序列化。**
- 运行时约束：核心 loop/Agent 类无 `node:` 依赖（grep 仅 `harness/env/nodejs.ts` 的 `NodeExecutionEnv` 依赖 node:child_process 等 9 处，属 coding-agent 专属）；**pi-agent-core 可跑在 browser**（`streamProxy` 即面向浏览器代理场景，`packages/agent/src/proxy.ts:118-235`）。

### 3.4 多轮对话 / 澄清能力评估

- 多轮：原生支持（context.messages 累积 + `continue()` + steer/followUp）。
- **缺参追问（澄清）**：pi 无内建"澄清"概念，但两种实现路径都成熟：① 用 tool calling 让模型调用 `ask_clarification` 工具返回缺参问题（`ToolResultMessage` 支持 `isError`/内容回灌）；② agent loop 内 `beforeToolCall` 校验参数不满足时 block 并附 `reason` 回给模型（`agent-loop.ts:636-647`）。
- **失败引导**：tool 抛错 → `isError: true` 的 toolResult 回给 LLM 自行修正（`README.md:440-456`）；`transformContext` 可做上下文压缩（`agent-loop.ts:288-292`、`types.ts:200`）；harness 层甚至有 compaction/branch-summary（coding-agent 场景，可忽略）。

**置信度：高**。

---

## 4. packages/protocol、client、server — 远程 agent 协议（实验性）

| 包 | 职责 | 关键事实 |
|---|---|---|
| `@earendil-works/pi-protocol` | 传输无关的 CBOR 二进制协议 v1（`packages/protocol/src/schemas.ts:3`）：`[uint32-be 长度][CBOR 负载]` 帧（`README.md:5-9`） | 消息全集见 `schemas.ts:291-449`：命令 `list/create/attach/detach/prompt/steer/abort/set_model/set_thinking`；事件 `server_snapshot/session_snapshot/session_progress/session_removed`；**快照为权威状态、progress 仅 UI 提示**（`README.md:10`）。**"experimental，无兼容性保证"**（`README.md:69`） |
| `@earendil-works/pi-client` | 传输中立客户端 `PiClient` + `SessionLease`（`packages/client/src/session-handle.ts:19-33`），可 WebSocket/Unix socket，Node 内置依赖为零（`README.md:3`） | Unix 传输在 `@earendil-works/pi-client/unix` 子路径（`README.md:45-63`） |
| `@earendil-works/pi-server` | 会话服务器框架 `PiServer`（`packages/server/src/server.ts:39-378`）：握手 → 命令分发（`sessions.ts:47-120`）→ 快照广播 | **不内置 agent 实现**：应用需实现 `PiServerService`（`server/README.md:15-28`）返回 `PiSessionRuntime`；仅提供 Unix socket 传输（`packages/server/src/transports/unix/`）。**"Experimental…may be changed or removed without notice"**（`server/README.md:3`） |

**对选型的结论**：协议面完整（远程会话/流式进度/steering），但三包均实验性 + `PiServer` 是框架而非成品（无 HTTP/WebSocket 预设 listener、无 CLI）；**不建议生产直接依赖**。若要"pi 风格"的远程协议，可从 `schemas.ts` 借鉴命令集与快照/进度分离设计。

**置信度：高**（README 与源码一致）。

---

## 5. 对我们的启示：方案 A / B / C 评估

前置约束（来自项目背景与 tech-stack-selection.md）：agent server 现选型 Go 模块化单体 + React 前端；需与 yuchen-smart-ops 的 Go 代码融合；领域 agent 的 LLM 交互模式单一（意图提取 → 多轮澄清 → 几何生成 → 校验 → GBH 提交）。

### 5.1 方案 A：直接采用 pi npm 包（后端改 Node/Bun/TS）

**可行性**：技术成立。`@earendil-works/pi-ai`（LLM 层）+ `@earendil-works/pi-agent-core` 的 `Agent` 类（runtime）即可覆盖流式回复/tool calling/多轮/失败引导/可插拔 provider 全部需求；两包核心层运行时中立，Node ≥ 22.19（Bun 亦兼容，`coding-agent` 官方用 `bun build --compile`，`coding-agent/package.json:38`）。

**优点**：零自研 agent 基础设施；多 provider 免维护（catalog 自动更新、`compat` 自动探测）；成本核算/缓存/thinking 免费获得；Context 纯 JSON 序列化使会话持久化简单。

**缺点与风险**：
1. **语言栈分裂**：agent server 变 TS/Node，与 Go 单体（几何生成、GBH 提交、SQLite）之间需要进程边界或 RPC；与 yuchen-smart-ops 的 Go 融合路径冲突（两套部署/两套监控）。
2. **依赖体积**：安装期全量落地 `openai`/`@anthropic-ai/sdk`/`@google/genai`/AWS SDK（`packages/ai/package.json:62-73`），即使只用一家 provider。
3. **0.x 演进期**：v0.84.2（2026-08-14 发布），Unreleased 段即有 Breaking Changes（`CHANGELOG.md:3-8`）；升级需跟随。
4. **超配**：harness 层（文件系统/编辑/compaction）与领域 agent 无关；protocol/server/client 实验性不可依赖。
5. 版本更新节奏快 → 供应链 review 成本（该项目自身采用 pin 精确版本策略，`README.md:78-88`，说明其对依赖变更极敏感）。

**适用条件**：团队接受后端改 Node/Bun，且"多 provider 切换"是硬需求。

### 5.2 方案 B：Go 保留，移植 pi 的核心模式（推荐主选）

**可行性**：高。领域 agent 的 LLM 交互模式简单，不需要 pi 的完整功能面。需要移植的核心模式（按价值排序）：

| # | pi 模式 | 参考实现 | Go 移植要点 |
|---|---|---|---|
| 1 | **事件流协议**（`AssistantMessageEvent`：start/text_delta/toolcall_delta/done/error） | `packages/ai/src/types.ts:535-551` | goroutine + channel 天然对应；是前端流式 UI 与后端解耦的契约核心 |
| 2 | **Provider 三层抽象**（API 实现 / Provider / Models 集合） | `packages/ai/src/models.ts:97-223` | `Model{id,api,provider,baseUrl,contextWindow}` 元数据 + 接口；对接 yuchen-smart-ops 已有的双 Provider 接口范式（tech-stack-selection.md:20） |
| 3 | **agent loop 双层循环**（turn + tool batch） | `packages/agent/src/agent-loop.ts:155-275` | 内层 tool 循环 + 外层 follow-up 轮询；Go 实现约 200 行 |
| 4 | **tool 分发 + 生命周期**（validate → beforeToolCall → execute → afterToolCall → 结果回填） | `agent-loop.ts:600-758` | 参数校验（Go 用 `encoding/json` + 手写 schema 或 `sigs.k8s.io/yaml`/`jsonschema` 库）；错误以 `isError` 结果回给 LLM 而非中断 |
| 5 | **"错误编码进流"哲学**（不 throw，stopReason=error/aborted + errorMessage） | `types.ts:325-332`、`README.md:897-919` | 失败引导（LLM 可读取错误并自我修正）的关键 |
| 6 | **Context 纯 JSON 序列化** | `README.md:1339-1370` | 多轮状态保持 + SQLite 持久化零成本 |

**优点**：单一语言栈；依赖可控（仅需 1-2 个 provider 的 HTTP 客户端，可直接用 Go 标准库或 openai 兼容 SDK）；与 yuchen-smart-ops 融合无冲突；对 GBH 提交等 Go 既有模块调用直接。

**缺点与风险**：移植工作量（估算核心 ~1-2 周含测试）；若未来要求多 provider 且不想维护适配（thinking 参数差异、缓存标记差异），Go 侧需自行处理 `compat` 类差异（pi 的 `OpenAICompletionsCompat`/`AnthropicMessagesCompat` 等，`types.ts:557-708` 展示差异复杂度上限）；事件流协议若设计不当会返工。

### 5.3 方案 C：混合 — pi-ai sidecar + Go 编排

**可行性**：技术上可行但最复杂。pi-ai 是 npm 包无法在 Go 内调用，只能以独立 Node/Bun 进程做 LLM sidecar，暴露 HTTP/SSE 流式接口；Go 消费事件流并做 agent 编排。

**优点**：Go 主体保留（融合路径不受影响）；获得 pi-ai 的多 provider/懒加载/成本核算；agent loop 在 Go 侧自控。

**缺点与风险**：双进程部署 + 进程管理 + 自定义桥协议 + 调试面增大；sidecar 传输的正是方案 B 模式 #1（事件流协议）——**协议还得自己定义**，等于同时承担 B 的移植成本与 A 的运维成本；单机演示场景收益不明显。`streamProxy`（`packages/agent/src/proxy.ts`）展示的代理模式方向相反（browser client → Node server），不能直接复用为 Node → Go。

**适用条件**：多 provider 是硬需求 **且** Go 主体不可变 **且** 不接受改 TS 后端——三方同时成立才值得。

### 5.4 推荐

**主选：方案 B**。理由：
1. 领域 agent 的 LLM 交互面窄（意图提取 + 澄清），pi 的核心价值（多 provider 目录、跨 provider 切换、harness 工具链）在单机单 provider 场景下大部分用不上；
2. Go 单体 + yuchen-smart-ops 融合是既定约束，语言栈统一收益大于多 provider 免维护收益；
3. 事件流协议等 6 个核心模式可被 Go 以更简单形式复刻，风险可控、可测试。

**激进备选：方案 A 的子集**——若后续产品明确要"多 provider 一键切换 + 快速上线"，可把 agent server 改 Node/Bun：只依赖 `pi-ai` + `pi-agent-core` 的 `Agent` 类（**不引入** experimental 的 protocol/server/client，也不引入 harness），几何生成/GBH 提交通过 Go 侧保留的 HTTP 服务调用。此路径与方案 B 的差异是语言栈而非架构（模式相同）。

**明确排除：方案 C**（除非上述三方条件同时成立）。

---

## 6. 风险与回滚

| 方案 | 主要风险 | 最坏情况 | 回滚 |
|---|---|---|---|
| A | Node 22 运行时升级、依赖体积、0.x API 变动、双语言栈、供应链 pin 成本 | agent server 与 Go 后端边界腐烂，升级 pi 破坏流式协议 | 保留 Go 侧 LLM 直调路径（几何生成等核心链路不回退到 pi） |
| B | 移植模式失真（尤其事件流契约与错误编码哲学）、多 provider 适配自行维护 | 事件流协议设计返工；多 provider 需求突增时适配成本高 | 低：模式清晰，Go 实现可控，随时可扩展 |
| C | 双进程运维、桥协议自定义、调试面 | sidecar 挂掉影响全部 LLM 调用；协议两边漂移 | 中：可回退到 B |

**长期维护视角**：方案 A 把"provider 适配"这一随 LLM 生态高频变化的部分外包给 pi（利好），但引入 npm 供应链与 0.x 版本漂移（利空）；方案 B 把适配内化为自研（若长期仅 1-2 个 provider，维护成本低；若 provider 矩阵扩大，成本线性上升）。

---

## 7. 元评审（自省）

- **剩余未知**：pi 包在真实生产服务中的稳定性/维护体验无外部数据（本地代码推断，置信度中）；pi-ai 懒加载在 Bun 单文件编译下的行为未实测（`coding-agent/package.json:38` 的 `bun build --compile` 表明官方支持，置信度中）。
- **最弱证据**：方案 A 的"升级风险"基于 CHANGELOG 推断（0.x + Unreleased 有 breaking），未统计历史破坏性变更频率。
- **可能错误的假设**：假设项目 LLM provider 矩阵短期内 ≤2 家——若产品定位"多 provider 自由切换"，方案 A 权重应上调。
- **未覆盖**：pi 的 evals/telemetry 包、coding-agent 的完整 server 模式（`src/server/` 仅 harness 组装）未深读；protocol 的 CBOR 实现细节未逐行核验（不影响结论）。

---

## 附录：关键文件索引

| 主题 | 文件 |
|---|---|
| 统一 API 事件类型 | `packages/ai/src/types.ts:535-551` |
| Provider/Models 抽象 | `packages/ai/src/models.ts:97-223, 762-862` |
| 事件流实现 | `packages/ai/src/utils/event-stream.ts:4-67` |
| 工具校验 | `packages/ai/src/utils/validation.ts:302-330` |
| Agent loop | `packages/agent/src/agent-loop.ts:31-54, 155-275, 281-372` |
| Agent 类/状态 | `packages/agent/src/agent.ts:173-592` |
| Tool/事件类型 | `packages/agent/src/types.ts:386-443` |
| 会话日志模型 | `packages/agent/src/harness/session/session.ts:102-299` |
| 远程协议消息全集 | `packages/protocol/src/schemas.ts:291-449` |
| 会话服务器框架 | `packages/server/src/server.ts:39-378`、`sessions.ts:47-120` |
| 浏览器代理流 | `packages/agent/src/proxy.ts:118-235` |
