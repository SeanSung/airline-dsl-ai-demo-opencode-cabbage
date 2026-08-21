---
issue: null
test_commands:
  - bun test src/intent    # server/ 目录：intent 纯函数单测
verify_commands:
  - npm test               # 根目录：仓库级回归通过
---

# intent-core

## Builds

部分 Intent 可被确定性校验（缺失字段清单）、多轮合并（补充不丢已有字段）与默认值补齐，得到完整 Intent——这是多轮澄清协议（spec §6.2 方案 Y）与降级解析共用的数据基础：缺什么、怎么补、默认值从哪来，全部收拢在本模块。

## Acceptance Criteria

- [ ] `intent/intentSchema`（TypeBox）字段与 required 集合对齐 spec §6.1：required = `['region','shape','center','radiusM','heightM','speedMps','actions']`，`actions` 允许空数组（明确"无动作"合法）
- [ ] `intent.validateIntentParams(partial)` 返回 `{ ok: true } | { ok: false, missing: string[] }`，`missing` 输出确定性、可断言（Spec §12.4）
- [ ] `intent.mergeIntent(partial, draft)`：非 undefined 字段覆盖、其余保留；先给 `center` 后补 `heightM` 时 `center` 不被覆盖；未提供字段保持 undefined 等待后续补充（Spec §12.5）
- [ ] `intent.applyDefaults(intent)`：`count=8`、`gimbalPitchDeg=-90`、`rthAltitudeM=100`、`name` 自动生成；`region`/`center` 默认沧海校区/机巢锚点
- [ ] 回归：`npm test` 通过

## Blocked By

- shared-contract

## Implementation Notes

- `intentSchema` 供 pi-ai 的 `generate_route` tool 参数校验直接复用（TypeBox `validateToolArguments`，spec §6.2 方案 Y）
- `validateIntentParams` 的 `missing` 输出是澄清协议的唯一数据源（"一次只问一项"由 missing 清单 + prompt 共同保证，可单测断言）
- 本 Task 只做 intent 模块纯函数；LLM 侧的澄清闭环集成在 `agent-route-generation` Task
