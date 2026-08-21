---
issue: 13
test_commands:
  - vitest run src/api/useChatStream.test.tsx src/components/ChatPanel.test.tsx   # frontend/ 目录：mock fetch 的流式渲染组件测试
verify_commands:
  - npm test                          # 根目录：仓库级回归通过
  - npm run dev -w @airline-dsl/frontend   # 可选：本地起前端联调
---

# frontend-chat-stream

## Builds

用户在浏览器发起自然语言 → 流式打字机回复 → 缺参追问循环 → 生成后展示 RouteCard（含"非 AI 生成"标注）与解析详情（Intent JSON）——**对话闭环 UI 可工作**（spec §11.1.2 交互 1–6）。

## Acceptance Criteria

- [ ] `frontend/` 包可 `vitest run`（React 19 + Vite + TS + vitest/RTL 基建）
- [ ] `api/useChatStream`：POST 后按 `data:` 行解析 SSE 事件并 dispatch；mock fetch 返回 SSE 流驱动状态（Spec §12.10）
- [ ] `ChatPanel`：消息列表流式追加（打字机 `text_delta`）、建议话术区（2–4 条点击即发）、输入框发送、新建会话
- [ ] 缺参追问气泡（"待补充参数"标签）；`error` 事件 → 错误条展示
- [ ] `route_generated` → RouteCard 出现；`aiGenerated: false` 时显示"非 AI 生成"标注（Spec §12.10）
- [ ] 解析详情：消息气泡可展开，展示 Intent JSON（region/shape/center/radiusM/heightM/speedMps/actions）
- [ ] `state/` 用 `useReducer` + Context 三 slice（conversation/currentRoute/history）
- [ ] 组件测试覆盖：事件流增量追加、route_generated 触发卡片、error 触发错误条、aiGenerated 标注
- [ ] 回归：`npm test` 通过

## Blocked By

- #12

## Implementation Notes

- SSE 解析用 `fetch` + `ReadableStream`（不走 EventSource：需要 POST 且事件类型多样，spec §9.2）
- 视觉基调（深色科技风 `#0b1220` 深空蓝 + 高亮青蓝 `#38bdf8` + 语义色）对照 spec §11.1.3 实现；UI 视觉层不设单测，由 review 阶段人工验收（§11.1.6）
- Header 状态徽标（LLM 在线/降级）随本 Task 落位（§11.1.1）
- 不引入状态管理库（spec §2：useReducer 足够）
