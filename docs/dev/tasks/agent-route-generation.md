---
issue: 10
test_commands:
  - bun test src/test/route-generation.test.ts   # server/ 目录：假 LLM 澄清闭环集成测试
verify_commands:
  - npm test                                     # 根目录：仓库级回归通过
---

# agent-route-generation

## Builds

自然语言经 LLM 提取意图后生成航线：参数齐备时一轮对话即产出 `route_generated` 事件并落库；缺参时 `generate_route` 校验拦截（isError 回灌）→ LLM 追问 → 用户补参后生成——**多轮澄清闭环（spec §4.1/§4.2）完整可工作**。

## Acceptance Criteria

- [ ] `generate_route` tool（TypeBox schema 复用 intent-core）注册进 Session API；execute 内链路：`validateIntentParams` → `mergeIntent` → `applyDefaults` → `orbitWaypoints` → `buildAirlineContent` → `validateAirlineContent` → `store.routes.create`（status='draft'，aiGenerated=true）→ 返回 `{ routeId, intent, content }` 回灌 LLM
- [ ] 缺参：execute 抛 `MissingIntentParamsError{ missing }` → pi 编码 `isError: true` toolResult 回灌 → 假 LLM 依据 missing 输出追问（每次只追问一项，Spec §12.4）
- [ ] 用户补参后下一轮：事件流出现 `route_generated{ routeId, content, aiGenerated: true }`
- [ ] 多轮补充不丢已有参数：先给 center 后补 heightM，最终 Intent 两者俱全（merge 在轮次间生效，Spec §12.5）
- [ ] `AirlineValidationError` 同样回灌（校验 errors 带字段路径，LLM 转述引导改正，§13 #9）
- [ ] system prompt 定义领域角色、澄清协议（"一次只问一个缺失项"）、生成协议（"参数齐备后才调 generate_route"）
- [ ] 事件转发：`text_delta` 增量转发、生成成功时发 `route_generated`（对齐 shared/events.ts）
- [ ] 集成测试注入脚本化假 LLM：第一轮缺参 toolcall → 断言 isError 回灌 → 第二轮补全 toolcall → 断言 `route_generated` 事件序列
- [ ] 回归：`npm test` 通过

## Blocked By

- #4
- #7
- #5
- #6
- #8

## Implementation Notes

- 落库在 tool 内完成：`content_json` 是航线数据单一权威（spec §4.1/§10），`intent_json` 供续编上下文回填
- 遵循 spec §6.2 方案 Y：唯一 tool、校验拦截、错误编码回灌、prompt 约束追问节奏；不引入 `ask_clarification` 第二工具
- 本 Task 依赖 `pi-agent-session-core` 已确认的 pi API 暴露方式；若 tool 注册/isError 编码与实现不符，先在 `pi-agent-session-core` 的验证结论内调整，不重新设计 Session API 契约
