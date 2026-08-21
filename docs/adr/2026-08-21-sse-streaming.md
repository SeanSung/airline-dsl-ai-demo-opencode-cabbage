# ADR-0002: 流式回复采用 SSE（POST 请求体即 SSE 响应流）

- 日期：2026-08-21
- 状态：Accepted
- 关联：`docs/dev/specs/airline-dsl-edit-agent.md` §2/§9；PRD §5.4（流式回复）

## 背景

多轮澄清与打字机回复要求 server→client 的流式推送。交互形态：客户端 POST 用户消息 → server 流式返回 agent 事件（`text_delta`/`clarification`/`route_generated`/`error`/`done`）。候选：SSE 或 WebSocket。

## 决策

**采用 SSE**：`POST /api/conversations/:id/messages` 的响应体即 `text/event-stream`，前端用 `fetch` + `ReadableStream` 逐 `data:` 行解析（不走 `EventSource`——需要 POST 且事件类型多样）。

## 为什么不用更简单的方案

- **为何 WebSocket 不是更简单方案**：本应用交互是"请求-响应式"单向流（client→server 只有"发消息"，server→client 是事件流）。WebSocket 引入双向通道、握手、心跳、重连、连接状态机，而这些问题 SSE 全部不存在（复用 HTTP 语义，断线即本轮失败、重发即可，符合 PRD 的失败引导模型）。
- **为何不用 `EventSource`**：`EventSource` 仅支持 GET（无法携带消息体）且不支持自定义 header；改用 POST + `fetch` 读流是等价且更简单的传输，没有引入任何新协议。
- **为何不"SE 与 WS 双支持"**：单机演示场景单一通道即够，双通道是过度设计（YAGNI）。

## 后果

- Hono 原生 `streamSSE` 支持，server 端实现为零额外依赖。
- 事件契约（`shared/src/events.ts`）与传输解耦：事件类型对齐 pi 的 `AssistantMessageEvent` 命名（`text_delta`/`done`/`error`），追加领域事件 `route_generated`/`clarification`。
- 限制：单向流无法推送 server 主动消息（如异步 GBH 回调）——当前产品无此需求；若未来需要"提交后异步回执推送"，可仅对该场景引入 WebSocket 或短轮询，不改整体架构（two-way door）。
