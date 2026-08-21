# ADR-0001: 采用 pi agent toolkit 与全 TS 单栈（Bun 运行时）

- 日期：2026-08-21
- 状态：Accepted
- 关联：`docs/dev/decision-map.md` dm-012；`docs/dev/research/pi-agent-toolkit.md`；`docs/dev/specs/airline-dsl-edit-agent.md`

## 背景

agent server 需要：流式回复、tool calling、多轮状态、缺参澄清、失败引导。调研（`pi-agent-toolkit.md`）给出三方案：A 直接采用 pi npm 包（后端改 TS）、B Go 移植 pi 核心模式（原推荐）、C pi-ai sidecar + Go 编排。技术栈调研（`tech-stack-selection.md`）原推荐 Go 模块化单体，但 dm-012 已拍板**后端全 TS 单栈 + 直接采用 pi npm 包**。

## 决策

1. **采用 `@earendil-works/pi-ai`（LLM 层）+ `@earendil-works/pi-agent-core`（Agent 类）**，不使用 experimental 的 protocol/server/client 包，不使用 coding-agent 专属 harness 层。
2. **后端全 TS 单栈**：几何生成、GBH 提交、SQLite、HTTP API 全部 TS 实现（Node/Bun）。
3. **运行时选 Bun**：pi 官方以 `bun build --compile` 分发 coding-agent（Bun 兼容有官方佐证）；`bun:sqlite` + `bun test` + TS 直跑使全 TS 单栈零构建步骤。

## 为什么不用更简单的方案

- **为什么不选方案 B（Go 移植）**：dm-012 已拍板全 TS 单栈（上游决策，不在本 ADR 讨论范围）。方案 B 的"移植 6 个核心模式"成本在此前提下无意义——npm 包直接可用。
- **为什么不选方案 C（sidecar）**：双进程 + 自定义桥协议 + 调试面，单机演示场景收益为负（调研 §5.3 明确排除）。
- **为什么不选 Node 24 而用 Bun**：Node 需 `--experimental-strip-types`/`tsx` 构建步骤且原生 TS 支持有语法限制（enum/namespace 等）；Bun 内置 TS 直跑、`bun:sqlite`、`bun test`，是"全 TS 单栈零构建"最简形态。Node 24 保留为回退路径（pi `engines >= 22.19`，两运行时下代码无差异，SQLite driver 差异被 Store Module 封装）。

## 后果

- 获得：多 provider 统一 API（DeepSeek 走 OpenAI 兼容通道）、TypeBox tool calling 校验、事件流协议、纯 JSON 会话状态（落库/恢复零成本）。
- 承担：pi 0.x API 快速演进期（v0.84.2，Unreleased 段有 breaking change）；npm 供应链与依赖体积（安装期全量落地多家 SDK，运行时按 provider 懒加载）。
- 缓解：锁精确版本；agent 模块（`server/src/agent/`）作为深度 Module 封装 pi API，升级漂移局部化；实现首任务 spike 验证接入 API 细节（方案 `specs` §13 #1/#2）。
- 明确不做：pi protocol/server/client（experimental）、harness/session-backend（coding-agent 专属，会话由本项目自管序列化到 `conversations` 表）。

## 替代方案重新评估

| 方案 | 为何否决 |
|---|---|
| Go 移植 pi 模式 | 与已拍板全 TS 单栈冲突；移植成本（核心 ~1-2 周含测试）高于直接依赖 |
| pi sidecar + Go 编排 | 双进程运维 + 自定义桥协议 + 收益不明显 |
| 手写 LLM 客户端（Go 调研方案 A） | 失去 tool calling 校验、事件流协议、多轮状态管理等成熟能力 |
