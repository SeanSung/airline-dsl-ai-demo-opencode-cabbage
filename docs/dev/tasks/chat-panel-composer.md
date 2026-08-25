---
issue: 51
test_commands:
  - npx vitest run src/components/chat/ChatPanel.test.tsx src/components/chat/Composer.test.tsx
verify_commands:
  - npm test
---

# chat-panel-composer

## Builds

`ChatPanel` 使用 shadcn 消息滚动组件重写 + `Composer` 四态（空态问候/建议、Enter 发送 / Shift+Enter 换行、多行自适应 1–6 行、流式停止按钮）可工作——**对话交互完整可工作**（spec §3.5，T8 + T3 的 DOM 部分）。

## Acceptance Criteria

- [ ] 空态（messages.length===0 且 status!=='streaming'）：`getByTestId('composer-greeting')` 存在，`getAllByTestId('suggestion').length === 3`，点击 suggestion 即发送该文本（产生 `bubble-user`）（T8 + PRD 7.3）
- [ ] 消息流使用 shadcn `MessageScrollerProvider/Viewport/Content/Item`；用户 → `bubble-user`（实底青），助手 → `bubble-assistant`（卡片面），clarification → `clarify-tag`，error → `bubble-error`（T8）
- [ ] 流式中末尾气泡挂 `Loader2`（`typing` testid）（T8）
- [ ] Enter（无 shift）→ 发送（`bubble-user` 出现）；Shift+Enter → 不发送、textarea 含换行（T8）
- [ ] IME composition 期间 Enter 不拦截（`isComposing` / keyCode 229 守卫）（spec §3.5）
- [ ] 多行自适应：1–6 行高度递增，第 7 行起 `scrollHeight > clientHeight`（textarea 内部滚动，composer 外层高度不再增长）（T8）
- [ ] 流式中 composer 右侧为 `composer-stop`（Square 停止按钮）；非流式为 `composer-send`（纸飞机，文本 trim 空时 disabled）（T8 + T3 DOM）
- [ ] `+` 按钮 disabled（`aria-label="附件（暂不可用）"`）（PRD 7.5）
- [ ] `errorBar` 在 Composer 上方渲染 `role="alert"`，文案不含原始 JSON/堆栈花括号；提供重试入口（T5 DOM 部分）
- [ ] Composer 外形：`rounded-2xl border bg-card shadow-sm`，focus-within `ring-2 ring-ring`（token）（spec §3.5）
- [ ] `npm test` 通过

## Blocked By

- airline-chat-transport

## Implementation Notes

- Composer 为 `<form>` + 多行 `<textarea>`（`rows=1`，监听 input 事件自适应高度：设 `height='auto'` 再读 `scrollHeight`，clamp 到 ≤6 行行高）
- shadcn chat 组件通过 `npx shadcn@latest add message-scroller message bubble attachment marker` copy 进 `components/ui/`
- Enter 发送须 IME composition 守卫（`nativeEvent.isComposing` / `keyCode === 229`）
- 所有颜色/间距/圆角引用深色设计 token，不硬编码颜色字面量
- 保留现有 testid 契约：`bubble-user` / `bubble-assistant` / `bubble-error` / `typing` / `suggestion` / `error-bar`
