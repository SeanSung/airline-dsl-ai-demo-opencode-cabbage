---
issue: 49
test_commands:
  - npx vitest run src/api/airline-chat-transport.test.ts src/state/useAirlineChat.test.tsx
verify_commands:
  - npm test
---

# airline-chat-transport

## Builds

`AirlineChatTransport` 适配器 + `useAirlineChat` 聚合 hook + `AirlineChatProvider` context 可工作——**流式对话全链路可工作**：发送消息 → 惰性建会话 → SSE 流式渲染 → 停止（abort）→ 错误降级 → 历史 hydrate → route 派生（spec §3.2–§3.3，T2/T3/T5/T6）。

## Acceptance Criteria

- [ ] `AirlineChatTransport.sendMessages`：取最后一条用户消息文本 → `ensureConversation()` → `POST /api/conversations/${cid}/messages` → `sseResponseToChunkStream`；`abortSignal` 透传给 fetch（T2/T3）
- [ ] `useAirlineChat` 返回 `messages/status/route/errorBar/conversationId/send/stop/regenerate/newConversation/loadConversation`（spec §3.3 接口）
- [ ] 发送后 `bubble-user` 出现、助手 `bubble-assistant` 文本逐 delta 增长；fetch 先 POST conversations 再 POST messages（T2）
- [ ] `stop()` 中止底层 fetch（`signal.aborted === true`）；已渲染助手文本保留不回滚（T3）
- [ ] SSE `error` 事件 → `errorBar` 非空，`role="alert"` 文案不含 JSON 花括号（T5）
- [ ] `route_generated` with `aiGenerated: false` → `route.aiGenerated === false`（降级标记）（T5）
- [ ] `loadConversation(id, routeId)` → stub GET conversations + routes → 历史消息渲染、route 设置、conversationId 设置，不产生新 POST（T6）
- [ ] `newConversation()` → messages/route/error 清空、conversationId 重置
- [ ] `route` 用 `useMemo` 从最后一条含 `airline-route` data part 的消息派生（spec §3.3）
- [ ] 模块级 `Map<routeId, conversationId>` 维护 route↔conversation 映射（从原 `useChatStream` 迁移）
- [ ] `npm test` 通过

## Blocked By

- agent-event-stream

## Implementation Notes

- `AirlineChatTransport` 实现 `ai` 包的 `ChatTransport<UIMessage>` 接口
- `reconnectToStream` 恒返回 `null`（后端不支持流续传，ADR 明确决策）
- `useChat` 使用 `id` 属性切换会话（配合 `ensureConversation` 惰性创建）；`newConversation` 通过重置 id 实现消息清空
- `RouteData` 类型定义在 `state/types.ts`（含 `aiGenerated` 前端 UI 状态字段，不进 shared）
- `AirlineChatProvider` 仅包裹 `useAirlineChat` + context；导出 `useAirlineChatContext()` 避免与 ai-sdk `useChat` 同名混淆
- transport 测试 stub `fetch` 按 URL 返回 conversationId 与 SSE body（沿用原 `useChatStream.test.tsx` 模式）
