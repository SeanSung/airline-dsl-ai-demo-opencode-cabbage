---
issue: 11
test_commands:
  - bun test src/test/degradation.test.ts   # server/ 目录：fallback 单测 + 降级集成测试
verify_commands:
  - npm test                                # 根目录：仓库级回归通过
---

# intent-fallback-degradation

## Builds

LLM 不可用时关键词规则兜底：参数齐备则走与 LLM 完全相同的生成链路（`aiGenerated: false` 贯穿事件与落库），缺参则输出确定性澄清文案——演示链路在 LLM 故障下依然可用且**不伪称 AI 生成**（spec §4.3/§8）。

## Acceptance Criteria

- [ ] `intent/fallback.parseIntent(text)` 关键词规则解析：`"环绕|绕|转圈"`→shape='orbit'；`"沧海|校区"`→region='沧海校区' + center=机巢锚点；`"半径\s*(\d+)"`→radiusM；`"高\s*(\d+)"`/`"(\d+)米"`→heightM；`"拍|拍照"`→takePhoto、`"悬停"`→hover、`"录像|录制"`→record
- [ ] `parseIntent("环绕沧海半径200米高120拍照")` → 完整 Intent（shape='orbit'、center=锚点、radiusM=200、heightM=120、actions=['takePhoto']，Spec §12.6）
- [ ] 假 LLM 注入失败（pi 流 error / stopReason='error'）→ `runTurn` 降级：先 `text_delta`（"当前为非 AI 生成"提示）→ `route_generated{ aiGenerated: false }`
- [ ] 降级生成同样落库且 `ai_generated = 0`
- [ ] 缺必填参数 → 返回确定性澄清文案（不发 route 事件）
- [ ] 回归：`npm test` 通过

## Blocked By

- #7
- #10

## Implementation Notes

- 降级路径走与 LLM 路径完全相同的 geometry → airline → store 链路（spec §4.3），仅 `aiGenerated=false` 与提示文案不同——复用而非复制
- `config.llmFallbackEnabled=false` 时不做降级，直接发 error 事件（配置控制）
- `aiGenerated` 字段贯穿 route 落库 → 历史列表 → 前端 RouteCard/地图徽标（spec §8 标注要求），本 Task 保证服务端侧完整
