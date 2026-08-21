---
issue: null
test_commands:
  - vitest run src/components/HistoryPanel.test.tsx   # frontend/ 目录：历史列表 + 续编组件测试（mock fetch）
verify_commands:
  - npm test                                          # 根目录：仓库级回归通过
---

# frontend-history-resume

## Builds

历史面板列出全部航线（含状态与非 AI 标注），可加载续编（对话历史 + 地图航线完整回填）并继续对话，可对历史航线再次提交 GBH——**完整演示链路（对话→生成→地图→提交→历史→续编）在浏览器端全部可工作**（spec §11.1.1 HistoryPanel / §4.4）。

## Acceptance Criteria

- [ ] `HistoryPanel.tsx`（左下方可收起）：`GET /api/routes` 列表展示（name/status/aiGenerated 标注/waypointCount/createdAt）
- [ ] 加载续编：`GET /api/conversations/:id` 回填对话历史 + `GET /api/routes/:id` 回填地图航线 → 用户可继续 POST 消息（对话历史完整、地图与对话一致，Spec §12.12）
- [ ] 对历史航线"再次提交 GBH"（复用提交状态反馈三态）
- [ ] 组件测试（mock fetch）：列表渲染、续编加载后 conversation 与 currentRoute 两 slice 同步回填
- [ ] 回归：`npm test` 通过

## Blocked By

- frontend-route-map

## Implementation Notes

- 续编必须同步回填 `conversation` 与 `currentRoute` 两个 slice，保证地图与对话状态一致（spec §12.12）
- 复用 RouteCard 展示 `aiGenerated` 标注（历史列表与非 AI 生成徽标逻辑不重复实现）
- 本 Task 完成后整体端到端链路已通；真实 DeepSeek + 真实 GBH 平台的现场 Door check（"对话 → 10 分钟出线 → GBH 通过"，spec §14 第 10 步）由调用方验收，不设独立开发 Task
