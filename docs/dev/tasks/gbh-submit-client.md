---
issue: 9
test_commands:
  - bun test src/gbh       # server/ 目录：submitRoute 集成测试（stub fetch）
verify_commands:
  - npm test               # 根目录：仓库级回归通过
---

# gbh-submit-client

## Builds

AirlineContent 可提交到 GBH 模拟飞行平台，平台响应（201/400/5xx/超时）被映射为结构化三态结果 `{status:'ok'|'invalid'|'error'}`、任何情况不 throw——结果直接驱动前端提交状态与错误展示。

## Acceptance Criteria

- [ ] `gbh.submitRoute(content, fetch?)` 注入的 `fetch` 可替换（测试注入 stub），POST `{gbhBaseUrl}/api/open/routes`
- [ ] 201 → `{ status: 'ok', routeId }`
- [ ] 400 → `{ status: 'invalid', errors }`（平台校验错误原样透传）
- [ ] 500 / 超时 / 网络失败 → `{ status: 'error', message }`，不 throw（Spec §12.7）
- [ ] 超时通过 `AbortSignal.timeout` 处理
- [ ] 回归：`npm test` 通过

## Blocked By

- #3

## Implementation Notes

- `fetch` 注入是公共行为边界（测试 stub，spec §5.6），非实现细节
- 错误编码进结果而非 throw，对齐 pi "错误编码进流"哲学（spec §5.6）
- 401 未鉴权按平台文档不存在鉴权处理（spec §13 #3）；`GBH_BASE_URL` 端口不一致问题由环境变量配置 + 启动健康检查在部署/验收阶段现场实测
