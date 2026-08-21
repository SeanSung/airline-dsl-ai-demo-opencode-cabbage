---
issue: 4
test_commands:
  - bun test src/test/session.test.ts   # server/ 目录：假 LLM 注入的会话集成测试
verify_commands:
  - npm test                            # 根目录：仓库级回归通过
  - DEEPSEEK_API_KEY=<key> bun test src/test/pi-smoke.test.ts   # 可选：真实 DeepSeek 冒烟
---

# pi-agent-session-core

## Builds

通过 agent Session API 可以创建会话、注入 LLM 驱动一轮对话并观察 `text_delta`→`done` 事件流，会话状态可序列化为纯 JSON、恢复后能带着完整历史继续对话。这是后续所有 agent 行为（澄清/生成/降级）的公共底座；本 Task 同时完成 **pi 0.x API 的最小接入验证**，确认 LLM 注入、工具分发与错误编码、状态序列化/恢复的真实暴露方式（消除 spec §13 #1/#2 的不确定性）。

## Acceptance Criteria

- [ ] `server/` 包可 `bun test`（Bun 运行时直跑 TS；deps: hono、@earendil-works/pi-ai、@earendil-works/pi-agent-core、typebox、@airline-dsl/shared 全部可解析）
- [ ] `config.ts` 按 §5.1 解析 `AppConfig`（dbPath/gbhBaseUrl/deepseek{baseUrl,apiKey,model}/tiandituToken/llmFallbackEnabled/heightLimitM/…），缺失或非法环境变量启动即报错退出
- [ ] `agent/session.ts` 实现 Session API：`createSession()` / `runTurn(handle, userText, onEvent)` / `serializeState(handle): string` / `restoreSession(messagesJson)`，`onEvent` 收到对齐 `shared/events.ts` 的事件
- [ ] 注入脚本化假 LLM 驱动 `runTurn`：`onEvent` 收到 `text_delta` → `done` 的合法序列
- [ ] `serializeState` 输出纯 JSON；`restoreSession` 后再次 `runTurn`，假 LLM 可观察到上一轮的全部消息（消息累积，状态往返无损）
- [ ] pi 工具机制验证：假 LLM 发起一个最小测试 tool 的调用，tool 内 throw 被 pi 编码为 `isError: true` 的 toolResult 回灌给 LLM（spec §13 #1 的"错误编码"确认点）
- [ ] 可选真实冒烟（`DEEPSEEK_API_KEY` 存在时）：真实调用跑通流式事件（text_delta→done），确认 LLM 注入方式在真实 provider 下可用
- [ ] 回归：`npm test` 通过

## Blocked By

- #3

## Implementation Notes

- 若 pi Agent 的 LLM 注入方式（构造参数/provider/streamFn）或状态序列化/恢复 API 与 spec 假设不符（§13 #1/#2），以实现可行路径为准：LLM 走构造注入；序列化不支持构造注入则退化为"重放消息"重建状态——并在 `session.ts` 注释中记录实际 API
- 不引入 experimental 的 protocol/server/client，不引入 coding-agent 专属 harness（ADR-0001）
- 本 Task **不实现领域 tool**；`generate_route` 在 `agent-route-generation` Task 加入，本 Task 的测试 tool 仅用于验证 pi 工具机制
- 若 pi API 暴露方式导致 Session API 契约（createSession/restoreSession/runTurn/serializeState）无法兑现，暂停并报告 Design Gap，不硬编码绕过
