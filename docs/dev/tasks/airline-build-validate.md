---
issue: 6
test_commands:
  - bun test src/airline    # server/ 目录：builder/validator 单测
verify_commands:
  - npm test                # 根目录：仓库级回归通过
---

# airline-build-validate

## Builds

Intent 可被映射为对齐 open-api 契约的 AirlineContent（takeoff/waypoints/全局参数/动作挂载），且非法内容（机型/坐标/高度/速度/动作参数）被校验拒绝、错误定位到字段路径——`errors` 直接作为 agent 引导输入与前端展示（"校验失败：第 3 个航点 altitude 超上限 500m"）。

## Acceptance Criteria

- [ ] `airline.buildAirlineContent(intent)` 按 §7.1 映射：`takeoff` = center（altitude 0）；waypoints 数量 = count；全局参数默认值（`global_height: 120`、`global_speed: 15`）；`finish_action: 'goHome'`、`rth_altitude: 100`、`takeoff_security_height: 50`、`exit_on_rc_lost: 'goContinue'`、`altitude_mode: 'relativeToStartPoint'`
- [ ] waypoint 字段映射：`altitude` = heightM、`speed` = speedMps、`heading_mode: 'fixed'`、`heading_angle: 0`、`turn_mode: 'clockwise'`
- [ ] 动作挂载位置：`takePhoto`/`hover`/`gimbalRotate` 挂首航点；`record` 拆为 `startRecord`（首航点）+ `stopRecord`（末航点）；`gimbalPitchDeg` → `gimbalRotate`（`pitch_angle`）挂首航点（Spec §12.2）
- [ ] `airline.validateAirlineContent(content)`：非法机型 / 越界坐标（如 lat=91）/ 超上限高度（>500m）/ 非法速度（>30m/s）/ 非法动作参数 → `{ ok: false, errors: [{ path, message }] }`，错误带字段路径（Spec §12.3）
- [ ] 合法输入 → `{ ok: true }`
- [ ] 回归：`npm test` 通过

## Blocked By

- #3

## Implementation Notes

- 校验常量（heightLimitM=500、speedLimitMps=30）为函数可选参数、默认取 spec 常量；http 组装时从 `AppConfig` 注入（spec §5.1/§7.2），本 Task 不依赖 config 模块
- `aircraft_model` 白名单来自 `shared/airline-content.ts`（单一事实源）
- `heading_mode:'fixed' + turn_mode:'clockwise'` 为 MVP 环绕语义常量（§13 #8），改动只在本模块
