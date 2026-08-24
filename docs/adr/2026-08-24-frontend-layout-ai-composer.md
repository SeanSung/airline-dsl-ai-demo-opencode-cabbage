# ADR-0004: 流式对话状态采用 @ai-sdk/react useChat + 自定义 transport

- 日期：2026-08-24
- 状态：Accepted
- 关联：`docs/prd/frontend-layout-ai-composer.md`（Issue #45）；技术方案 `docs/dev/specs/frontend-layout-ai-composer.md`；调研 `docs/dev/research/ai-ui-composer-selection.md`

## 背景

现有前端手写了一套对话状态：`chatReducer`（messages/route/streaming/errorBar）+ `useChatStream`（fetch 两阶段 + SSE 逐帧解析 + dispatch）+ `ChatProvider/useChat` context。它能工作且有测试，但存在三个问题：

1. **流式行为要自己维护**：stick-to-bottom、半截缓冲、abort、重生成、错误态全部手写，正是 AI 聊天 UI 最容易出边界 bug 的部分。
2. **PRD dm-304 明确要求流式中可停止、多行 composer、shadcn 消息滚动**——这些与 `@ai-sdk/react` 的 `useChat`（stop/regenerate/status）和 shadcn 官方 chat 组件天然契合。
3. 手写 reducer 与 shadcn message-scroller 各管一份消息状态，会产生状态同步成本。

调研（见 research 文档）排除了 assistant-ui（自带 runtime 接管状态，侵入高）、Ant Design X（需 antd+cssinjs，违反「不引入第二套 UI 库」硬约束）、CopilotKit（全栈过度工程）、shadcn-chat（已停维护）。

需要决策：流式状态到底是「保留手写 hook、仅用 shadcn 视觉组件」，还是「用 `useChat` 完全接管（含 route/error 等领域状态）」。

## 决策

- **流式对话状态完全采用 `@ai-sdk/react` 的 `useChat`（v5，transport 架构）**：messages/status/stop/regenerate 由 useChat 管理。
- **后端契约不变**，通过一个自定义 `ChatTransport` 适配器（`AirlineChatTransport`）把现有「`POST /api/conversations` 拿 id → `POST /api/conversations/:id/messages` 返回 `data: <AgentEvent>` SSE」桥接成 useChat 期望的 `ReadableStream<UIMessageChunk>`。
- **领域状态随流携带**：`route_generated` 转成 typed data chunk `data-airline-route`（payload 为 `RouteData`），`clarification` 转 `data-airline-clarification`，`error` 转 error chunk；route/errorBar 由 `useAirlineChat` 聚合 hook 从消息的 data parts / error 派生。
- SSE→chunk 的解析收成纯函数模块 `agent-event-stream`，transport 只负责网络与 abort。
- 新增运行时依赖 `@ai-sdk/react@^4` 与 `ai@^7`（后者仅取类型与 chunk 构造助手，tree-shaken，不引入任何模型 provider SDK）。
- 消息滚动/气泡/标记使用 shadcn 官方 chat 组件（copy-in 源码）。

本决策**有意覆盖** `docs/prd/frontend-ui-redesign.md` v1.0 第 10 节「现有组件功能契约与 props 语义保持不变，现有测试须继续通过」的约束：`chatReducer`/`useChatStream` 删除、其测试重写为 transport/映射测试；`ChatPanel` 等可视行为保持。

## 为什么不用更简单的方案

- **为何不保留 `useChatStream`、只换 shadcn 视觉组件（最小改动）**：这是调研时的推荐起点，但需求阶段 dm-304 用户明确选择「useChat 完全接管」。从工程角度，保留手写流式状态就仍要自己维护 abort/停止、重生成、半截缓冲与错误机——正是 useChat 已经解决且测试覆盖的部分；两边并存会产生「reducer 消息」与「scroller 消息」双状态源。既然要做停止/多行/重生成，迁到 useChat 的长期复杂度更低。
- **为何不用 `DefaultChatTransport` 直连 `/api/chat`**：默认 transport 假定单端点 POST messages 并返回 AI SDK 私有流协议；本项目后端是「先建会话再发消息」的两阶段 REST + 自定义 `AgentEvent` SSE，且不能改后端。自定义 transport 是唯一不改动后端的接入方式。
- **为何不把 route/error 留在独立 useReducer**：会回到「useChat 管消息、reducer 管领域」的双状态机，两者需在每次 onFinish/onError 手动同步。useChat v5 的 typed data chunk 机制就是为「在消息流里携带结构化数据」设计的，route 作为 `data-airline-route` 随消息落地，派生单一、时间序正确（route 一定在它对应的助手消息之后）。这是用其设计所长，而非滥用。
- **为何不引入 assistant-ui**：它自带 runtime/provider，会接管 thread/composer 状态，与现有 reducer 和深色 token 体系冲突，侵入性远大于 useChat（后者只提供 hook 与状态，UI 全自控）。
- **`reconnectToStream` 为何返回 null**：后端不支持流续传/Resume；硬造一个假实现违背诚实原则。返回 null 是接口允许的「无活跃流可恢复」语义，MVP 足够。

## 后果

- 删除 `frontend/src/state/chatReducer.tsx` 与 `frontend/src/api/useChatStream.ts`；新增 `api/agent-event-stream.ts`、`api/airline-chat-transport.ts`、`state/useAirlineChat.tsx`（含 provider/context）。
- `App.tsx`、`ChatPanel`、`AppShell`、`WorkspaceHeader` 等改用 `useAirlineChatContext()`；`GbhPanel`/`RouteMap` 的 route 来源切换（props 或 context），内部逻辑不变。
- `useChatStream.test.tsx` 重写为 `agent-event-stream.test.ts`（纯映射）+ `useAirlineChat.test.tsx`（transport/状态/hydrate/abort），覆盖原三条用例（text_delta/route_generated/error）并新增停止、hydrate、错误文案断言。
- 测试需要 stub `fetch` 并构造 `ReadableStream` SSE body（原测试已具备此模式，迁移成本低）。
- **风险**：useChat v5/ai@7 API 较新，chunk 构造助手的确切导出名以安装后类型为准；用纯映射测试 T1 先锁定 chunk 形状以隔离风险。data chunk 渲染层若过于曲折，可退回 transport 回调写外部状态（two-way door），但优先 data chunk 单状态源。
- 不新增 CSS-in-JS、不新增第二套 UI 库；shadcn chat 组件以源码 copy 方式入库，主题沿用现有深色 token。
