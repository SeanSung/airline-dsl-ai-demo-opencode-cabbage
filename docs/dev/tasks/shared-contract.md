---
issue: null
test_commands:
  - bun test            # 在 shared/ 目录执行（常量断言）
verify_commands:
  - npm install         # 根目录：workspaces 解析成功
  - npm test            # 根目录：仓库级回归通过
---

# shared-contract

## Builds

`shared/` 契约包与 monorepo 骨架就位：server（Bun）与 frontend（Vite/TS）两个 workspace 可以从 `@airline-dsl/shared` 导入同一套领域类型与常量（Intent / AirlineContent / SSE 事件 / 机巢锚点 / 几何常量），`npm test` 在仓库级可运行。本包是 spec §6/§7/§9 契约的唯一事实源，后续所有 Task 的跨包引用以此为准。

## Acceptance Criteria

- [ ] root `package.json` 声明 npm workspaces（`shared`/`server`/`frontend`）与聚合 scripts（`test`/`build`/`dev`），`npm install` 成功且无 workspace 解析错误
- [ ] `@airline-dsl/shared` 包为纯类型 + 常量、零运行时依赖；server 与 frontend 均可通过包名导入（类型可被消费）
- [ ] `src/intent.ts` 定义 `GeoPoint`/`RouteAction`/`Intent`，字段与 required 集合对齐 spec §6.1（required: region/shape/center/radiusM/heightM/speedMps/actions，actions 允许空数组；optional: name/count/gimbalPitchDeg/rthAltitudeM）
- [ ] `src/airline-content.ts` 定义 `AirlineContent`/waypoint/action 类型与枚举白名单，含 14 种 `aircraft_model`（M30/M30T/M350/M3E/M3T/M3M/M3TA/M3D/M3TD/M4E/M4T/M4D/M4TD/M400）
- [ ] `src/events.ts` 定义 SSE 事件五类型载荷（`text_delta`/`clarification`/`route_generated`/`error`/`done`），对齐 spec §9.2
- [ ] `src/constants.ts` 定义机巢锚点 `22.531635, 113.935066`、`111000` m/deg、默认全局参数（`global_height: 120`、`global_speed: 15`）
- [ ] 常量值有单测断言；类型定义与 spec §6.1/§7.1/§9.2 逐字段对齐

## Blocked By

- None

## Implementation Notes

- 本 Task 同时建立三个 workspace 的最小 `package.json`/tsconfig 骨架（npm workspaces 要求目录存在才能 install）；server/frontend 的业务代码在其各自 Task 中实现，不在本 Task 预写空壳
- 事件类型命名对齐 pi `AssistantMessageEvent` 命名风格（`text_delta`/`done`/`error` 直接复用），新增领域事件 `route_generated`/`clarification`
- 本包禁止引入任何运行时依赖；类型是本项目所有模块的公共 Seam
