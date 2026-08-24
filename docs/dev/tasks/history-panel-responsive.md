---
issue: 35
test_commands:
  - npm test --workspace frontend
verify_commands:
  - npm test
  - npm run build --workspace frontend
  - test "$(grep -rnE 'style=\{\{' frontend/src/components/history 2>/dev/null | wc -l)" -eq 0
---

# history-panel-responsive

## Builds

历史栏在两种断点下都可用：≥1440 时历史以常驻深色侧栏列出航线（状态徽章 + 续编/再提交）；1366 时收成图标窄栏，点击以 Sheet 抽屉滑出同一历史列表；列表加载、续编、再提交的功能与状态反馈保持不变。

## Acceptance Criteria

- [ ] HistoryPanel 迁到 `components/history/`，内部列表抽为 `RouteListItem`：展示航线名、`STATUS_LABEL`（草稿/已验证/失败）状态徽章、waypointCount、时间、续编按钮、再提交按钮
- [ ] 所有样式 Tailwind utility，`style={{`=0、无硬编码颜色；状态徽章用 shadcn `Badge` variant 映射 draft/validated/failed
- [ ] `open` 时 `refresh()` 拉取列表的行为不变；loadingList/error 空态有可见反馈
- [ ] 续编回调 `onResume(routeId, conversationId?)`、再提交 `onResubmit(routeId, setStatus)` 契约不变；再提交 loading/ok(含 gbhRouteId)/error 状态在列表项内可见
- [ ] ≥1440：HistoryPanel 常驻侧栏；1366：`HistoryRail` 图标按钮 + shadcn `Sheet` 承载同一 HistoryPanel（内部组件复用，不复制两套列表逻辑）
- [ ] 抽屉打开用 fixed overlay，不推动三栏 Grid、无整页 reflow
- [ ] 更新 `HistoryPanel.test.tsx` 适配新结构并保留断言意图（渲染 testid `history-panel`、续编/再提交触发回调、状态展示）；新增 1366 Sheet 触发的结构断言
- [ ] 回归：`npm test` 全绿

## Blocked By

- app-shell-three-column

## Implementation Notes

- HistoryPanel 设计为「内部列表 + 外层容器」：侧栏直接渲染，Sheet 内也渲染同一份；通过 props 控制是否带外层边框/标题，避免逻辑分叉。
- 1366 与 ≥1440 的切换是 CSS 响应式（Tailwind variant），不在 JS 里监听 resize；jsdom 测试通过断言「HistoryRail 存在 + Sheet 内存在历史列表」覆盖结构，真实断点切换归人工目检（design §T2）。
- 不改 API/数据获取逻辑。
