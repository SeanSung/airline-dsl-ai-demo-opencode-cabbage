---
issue: 5
test_commands:
  - bun test src/geometry   # server/ 目录：orbit 单测
verify_commands:
  - npm test                # 根目录：仓库级回归通过
---

# orbit-geometry

## Builds

输入圆心/半径/航点数即可得到等距环绕航点序列（恰好 count 个、闭合、与圆心距离一致），直接作为 AirlineContent waypoints 的坐标来源——"规则几何（MVP 仅环绕 orbit）"这一核心能力可工作。

## Acceptance Criteria

- [ ] `geometry.orbitWaypoints({ center, radiusM, count })` 返回恰好 `count` 个 `GeoPoint`
- [ ] 任取一个航点与 `center` 的球面距离 ≈ radiusM（按 `111000 m/deg` 换算，容差 ±radiusM×0.5%）
- [ ] 相邻航点角间距 = `360/count` 度（均匀分布）
- [ ] `count < 3` 抛参数错误（不成环）
- [ ] 纯函数：同输入同输出，无副作用、零依赖（Spec §12.1）
- [ ] 回归：`npm test` 通过

## Blocked By

- #3

## Implementation Notes

- 简化球面换算：纬度每度 111000m，经度按 `cos(lat)` 缩放，与参考实现算法一致（spec §5.4）
- 纯函数，Interface 即全部（spec §5.4），不引入任何额外依赖
