---
issue: 48
test_commands:
  - npx vitest run src/api/agent-event-stream.test.ts
verify_commands:
  - npm test
---

# agent-event-stream

## Builds

SSE `AgentEvent` 帧（`text_delta`、`clarification`、`route_generated`、`error`、`done`）可以被纯函数可靠地映射为 `@ai-sdk/react` 消费的 `UIMessageChunk` 序列——**流解析内核可工作**（spec §3.1，T1）。

## Acceptance Criteria

- [ ] `agentEventToChunks(ev, ctx)` 纯函数：`text_delta` → `text-start` + `text-delta` + `text-end` 序列；`route_generated` → `data-airline-route` data chunk（payload 深等于 `RouteData`）；`error` → error chunk（`message` 等于后端文案）；`clarification` → `data-airline-clarification` data chunk + 文本段；`done` → `finish` chunk
- [ ] `sseResponseToChunkStream(body, opts)` 接受 `ReadableStream<Uint8Array>`，正确解析 `data: ` SSE 帧（含多行缓冲、空行跳过），`onRoute` 回调在 `route_generated` 到达时触发，`signal` abort 可中止流
- [ ] chunk 构造统一使用 `ai` 包导出的 chunk 助手/类型，不手写字面量（spec §3.1）
- [ ] data chunk 类型名为 `data-airline-route` / `data-airline-clarification`（`data-<name>` 形式）
- [ ] 纯函数无 React、无 fetch、无全局状态依赖；测试可直接喂 `AgentEvent[]` 或编码字节断言输出 chunk 序列
- [ ] `npm test` 通过

## Blocked By

- None

## Implementation Notes

- chunk 构造用 `ai` 包助手不手写（spec §3.1 明确约束），避免协议字段漂移
- `sseResponseToChunkStream` 内部先做 `data:` 帧缓冲（SSE 协议：`\n\n` 分隔、`data:` 前缀），再逐帧 JSON.parse 为 `AgentEvent`，再调 `agentEventToChunks`
- `RouteData` 类型从 `state/types.ts` 导入（T2 建立该文件；若本 Task 先行则内联定义，T2 统一迁移）
- 测试用 `ReadableStream` + `TextEncoder` 直接构造 SSE 字节流，不 mock fetch
