---
issue: 34
test_commands:
  - npm test --workspace frontend
verify_commands:
  - npm test
  - npm run build --workspace frontend
  - test "$(grep -rnE 'style=\{\{' frontend/src/components/chat frontend/src/components/ChatPanel.tsx 2>/dev/null | wc -l)" -eq 0
---

# chat-panel-redesign

## Builds

对话栏视觉重设计完成：ChatPanel 使用 token 与 shadcn 基础组件渲染深色对话界面——用户/助手/错误消息气泡、空态建议、流式打字、错误栏、底部 sticky 输入框（发送中禁用+loading）全部视觉统一且功能不变；RouteCard 以参数卡样式在对话区展示结构化意图。

## Acceptance Criteria

- [ ] ChatPanel 拆为 `components/chat/` 下 `ChatPanel`（容器）+ `MessageList` + `MessageBubble`（user/assistant/error 三态）+ `ChatComposer`（textarea/input + 发送按钮）；`RouteCard` 迁到 `chat/RouteCard`
- [ ] 所有样式走 Tailwind utility / `cn()`，该目录 `style={{` 计数=0；颜色全部来自 token（无 `#xxx`/`rgb()` 字面量）
- [ ] 保留行为契约：发送消息、空态三条建议点击即发送、`state.streaming` 时发送按钮 disabled 且显示 loading、assistant delta 逐字追加、clarification 消息渲染、`error-bar`（`data-testid="error-bar"`）存在
- [ ] ChatComposer 内容区可滚动，输入框在对话栏底部 sticky；Enter 发送、Shift+Enter 换行（沿用原行为或在无原行为时按此实现，不破坏测试）
- [ ] RouteCard：展示 `intent` 与 `content` 中**非空**结构化字段（动作/高度/半径/圈数等），空字段不渲染；用 shadcn `Card`/`Badge`
- [ ] 降级标注：当 `state.route.aiGenerated === false`，在 RouteCard 显示 `data-testid="degraded-badge"`，文本含「非 AI 生成」，用 warning 配色，不与 success 态同色
- [ ] 更新 `ChatPanel.test.tsx` 以匹配新结构，但**保留断言意图**（发送、流式、错误、建议）；新增降级徽章测试与 streaming 禁用测试
- [ ] 回归：`npm test` 全绿

## Blocked By

- app-shell-three-column

## Implementation Notes

- Test Seam 沿用 design §T1/T3/T4：RTL 断言 DOM/role/text/disabled/testid；视觉（气泡配色/滚动）归人工目检。
- MessageBubble 用 `role` 或可查询结构；assistant 空文本在 streaming 起始时仍渲染气泡（对应 stream_start）。
- 不改 `chatReducer`/`useChatStream` 任何逻辑。
- 原 ChatPanel 头部「新对话」按钮逻辑已在 AppShell TopBar 承担，迁移时移除避免重复。
