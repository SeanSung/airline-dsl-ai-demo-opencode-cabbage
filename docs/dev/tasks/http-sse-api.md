---
issue: 12
test_commands:
  - bun test src/test/http.test.ts   # server/ 目录：app.request() 免端口契约测试
verify_commands:
  - npm test                         # 根目录：仓库级回归通过
  - bun run src/index.ts             # 可选：真实启动 server 冒烟
---

# http-sse-api

## Builds

浏览器可通过 REST + SSE 完整驱动 agent 对话与航线管理：`POST /api/conversations/:id/messages` 返回 `text_delta→route_generated→done` 的 SSE 事件流，历史/详情/提交 GBH/地图 token 端点齐全，错误统一 `{ error: { code, message } }`（spec §9 全端点契约可工作）。

## Acceptance Criteria

- [ ] `app.request()` 免端口契约测试（注入假 agent 会话层，脚本化事件序列）：
  - [ ] `POST /api/conversations` → `201 { conversationId }`
  - [ ] `POST /api/conversations/:id/messages` → `text/event-stream`，事件序列合法（text_delta → route_generated → done）
  - [ ] `GET /api/conversations/:id` → 会话对象（含 messages）
  - [ ] `GET /api/routes` → `RouteSummary[]`（id/name/status/aiGenerated/waypointCount/createdAt）
  - [ ] `GET /api/routes/:id` → `RouteDetail`（content/intent/aiGenerated/status/gbhRouteId?/gbhError?）；不存在 → 404
  - [ ] `POST /api/routes/:id/submit-gbh` → `{ status:'ok', gbhRouteId }` | `{ status:'invalid', errors }` | `{ status:'error', message }`（三态透传）
  - [ ] `GET /api/map-token` → `{ token }`
- [ ] 请求体校验失败 / 路由不存在 → `{ error: { code, message } }`，400/404/500 语义正确（Spec §12.9）
- [ ] `index.ts` 组装真实链路：config → store → agent（完整，含降级）→ Hono app，server 可启动
- [ ] SSE 响应为 `data: <json>` 行格式（spec §9.2）
- [ ] 回归：`npm test` 通过

## Blocked By

- #4
- #10
- #11
- #8
- #9

## Implementation Notes

- http 是薄层：请求体 JSON 校验、调用 Session API、把 `AgentEvent` 写入 SSE、状态码/错误映射；业务规则不落在 http（spec §5.8）
- SSE 用 Hono `streamSSE`；连接中断 = 本轮失败，用户可重发（spec §9.2）
- 契约测试注入假 agent 会话层（不依赖真实 pi 与网络监听）；真实链路由 `index.ts` 组装并在 verify 冒烟
- 校验常量（heightLimitM 等）由 `config` 注入 airline validator
