# Decision Map — 基于 DSL 航线编辑脚本的大疆航线编辑 Agent

> 需求澄清决策映射（flow-requirements）。初始前沿 Ticket 见下，逐个解决后收拢。✅ 全部前沿已 resolved（2026-08-21），PRD 已生成：`docs/prd/airline-dsl-edit-agent.md`

## 背景事实（已调研）

- 参考来源 1：`~/project/yuchen-smart-ops/` — 一网统飞低空综合作业平台，含航线规划模块（Cesium 3D 打点编辑、AirlineContent、GBH 模拟飞行下发）
- 参考来源 2：`~/project/airline-dsl-ai-demo/` — 同想法的先行实现（Go+React+Cesium）。**用户决策（dm-001）：本方案完全独立创新，不以先行实现为输入**，仅作存在性背景记录
- 当前项目（本仓库 opencode-cabbage）：空仓库，用 opencode + cabbage 插件从零起步

## Tickets

| Slug | Blocked by | Status | Type | Question | Answer |
|------|-----------|--------|------|----------|--------|
| dm-001-relationship | — | resolved | Grilling | 本仓库与 airline-dsl-ai-demo 的关系（复刻/迁移/增强） | **完全独立创新**：仅以 yuchen-smart-ops 航线规划模块 + DSL 航线脚本模块为参考，不以先行实现为输入 |
| dm-002-edit-scope | — | resolved | Grilling | "编辑航线"的 MVP 范围（生成后改参数重生成 vs 逐点微调） | **自然语言微调重生成**：MVP 编辑 = 对话式改参重生成，不做地图手动拖点（符合 agent 原生定位） |
| dm-003-interaction | — | resolved | Grilling | 对话交互深度（单轮生成 vs 多轮澄清） | **多轮澄清缺参追问**：缺关键参数（区域/高度/速度/动作）时 agent 反问补齐，参数齐全后生成 |
| dm-004-output | — | resolved | Grilling | 最终产物的"标准大疆航线"形态与出口（KMZ/WPML 下载 vs 提交模拟平台验证） | **GBH 模拟飞行验证**：生成航线一键提交 GBH 验证，地图预览 + 验证状态，形成可飞行闭环 |
| dm-005-region | — | resolved | Grilling | 演示/落地区域与基准（地图范围、机巢/起飞点坐标） | **沧海校区/机巢**：默认区域沧海校区，机巢锚定 22.531635, 113.935066，WGS-84 基准 |
| dm-006-llm | — | resolved | Grilling | LLM 选型与 Key 管理（服务端持有，可插拔 provider） | **DeepSeek，服务端持 Key**：Key 放后端环境变量，前端永不接触，CORS 收敛 |
| dm-007-stack | — | resolved | Research | 技术栈选型（后端语言/前端框架/地图组件/存储） | **后端全 TS 单栈（Node/Bun）+ 前端 React+Vite+TS + 原生 Cesium（天地图底图）+ SQLite**。详见 `docs/dev/research/tech-stack-selection.md`（后经 dm-012 修订） |
| dm-008-actions | — | resolved | Grilling | 航行动作 MVP 范围（拍照/录像/云台/悬停/返航等最小集） | **最小集**：拍照/悬停/录像 + 高度/速度/云台角/返航配置，对齐 open-api 动作子集 |
| dm-009-geometry | — | resolved | Grilling | 航线几何形状 MVP 范围（环绕/直线/之字扫掠等模板） | **MVP 仅环绕**：聚焦环绕巡检单场景演示，直线/之字后续迭代 |
| dm-010-failure | — | resolved | Grilling | 生成/校验失败处理策略（agent 引导改正 vs 静默回退） | **引导改正 + 明示降级**：错误定位到字段并引导修正；LLM 不可用时规则降级兜底且明确标注"非 AI 生成" |
| dm-011-history | — | resolved | Grilling | 航线持久化与历史管理（落库、列表、加载续编） | **落库 + 历史列表 + 加载续编**：SQLite 落库，历史列表可查看/加载续编/再次提交 GBH |
| dm-012-pi-agent | — | resolved | Research | agent server 技术选型是否采用 pi agent toolkit（earendil-works/pi） | **方案 A：直接采用 pi npm 包**：`@earendil-works/pi-ai`（统一多 provider LLM API）+ `@earendil-works/pi-agent-core`（agent runtime，agent loop + tool 分发 + 事件流 + 多轮状态）。**后端全 TS 单栈**：几何生成/GBH 提交/SQLite/HTTP API 全部 TS 实现，与前端同语言。不引入 experimental 的 protocol/server/client。详见 `docs/dev/research/pi-agent-toolkit.md` |
