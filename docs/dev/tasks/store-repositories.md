---
issue: 8
test_commands:
  - bun test src/store     # server/ 目录：Repository 集成测试（:memory: 库）
verify_commands:
  - npm test               # 根目录：仓库级回归通过
---

# store-repositories

## Builds

route 与 conversation 可完整落库/查询/更新（JSON 字段无损），agent 会话的序列化状态可存储并恢复，`findByRoute` 支撑"加载续编"入口——SQLite 持久层全能力可工作，`content_json` 成为航线数据的单一权威。

## Acceptance Criteria

- [ ] `store/db.ts` 用 `bun:sqlite` 打开并执行迁移 DDL（spec §10 两表 `routes`/`conversations` + 两个索引）；`Database` 实例构造注入，测试用 `:memory:`
- [ ] `RouteRepository`：`create/list/get/update` 全往返；`intent`/`content` JSON 序列化/反序列化在 Repository 内部完成，外部只见对象；含 unicode 中文 JSON 无损（Spec §12.8）
- [ ] `Route` 落库字段与 spec §5.2/§10 一致（id/name/intent/content/aiGenerated/status/gbhRouteId?/gbhError?/createdAt/updatedAt）
- [ ] `ConversationRepository`：`create/get/updateState/findByRoute` 全往返；`messages_json` 纯 JSON 存取
- [ ] `findByRoute(routeId)` 返回该航线绑定的会话（加载续编入口）
- [ ] 回归：`npm test` 通过

## Blocked By

- #3

## Implementation Notes

- 调用方只见对象 CRUD，SQLite 方言与 JSON 编码细节全部内部化（spec §5.2 Depth）
- 不引入 Repository 接口抽象：唯一的真实替换需求（测试 `:memory:` vs 生产文件）由 `Database` 构造注入满足
- 所有写操作走 prepared statement
