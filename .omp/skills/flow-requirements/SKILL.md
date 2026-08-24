---
name: flow-requirements
description: 渐进式需求澄清 → PRD → Parent Issue
---

# flow-requirements

通过渐进式需求澄清将松散想法凝固为 PRD，并创建 Parent Issue（Flow Record）作为后续阶段的权威来源。

## 核心理念：战争迷雾（Fog of War）

需求澄清不是一次性穷举——只定义**前沿**（当前可见的待决策问题），逐个解决，每解决一个迷雾推开一层，直到所有关键决策已定，PRD 自然成形。

## 核心原则：验收可判定（Testable Acceptance）

PRD 的验收标准是下游 `flow-design`（Testing Decisions）、`flow-tasks`（Acceptance Criteria）、`flow-tdd`（final-verification 逐条验证）的输入源。因此**每一条验收标准都必须能让一个没参与需求讨论的人或 fresh agent 独立判定 pass/fail**。

一条合格的验收标准：

- 描述**可观察的行为或产物**（界面可见、接口返回、文件产物、可测量数值），不描述意图、感受或努力。
- 自带**判定方法**：一条具体命令、一个数值阈值、一个 DOM/状态断言、或带分辨率的目检检查清单。
- 含边界与失败路径，不只写主路径。

**模糊词不构成验收标准。** 出现以下词必须量化为阈值，或降级为带检查项的人工目检清单：

> 好用、流畅、友好、美观、好看、现代化、简洁、完善、健壮、高性能、认可度、满意度、用户体验好、达到演示级、明显提升……

**严格区分两类指标，不得混淆：**

| 类型 | 性质 | 能否作为阶段完成判据 |
|------|------|---------------------|
| **验收标准 Acceptance Criteria** | 交付即可判定（命令/阈值/断言/目检清单） | ✅ 是 |
| **成功度量 Outcome Metrics** | 滞后/业务/主观结果（演示反馈、采用率、转化、满意度） | ❌ 否，只能参考 |

Outcome 可在 PRD 单列一节并显式标注"不作为阶段完成判据"；**不得**把它写进验收标准或 Parent Issue 的完成 checklist。

**坏 → 好对照：**

- 坏：`界面美观，达到演示级`（无判定方法）
- 好：`1920×1080 下正文与背景对比度 ≥ 4.5:1、无横向滚动（scrollWidth ≤ innerWidth）、无文字截断/重叠；判定：对比度抽查器查 5 处 + 控制台断言 + 两分辨率截图走查清单`
- 坏：`性能良好`
- 好：`对话提交到首字返回 ≤ 1s（p95）；判定：浏览器 Performance 面板/接口计时采样 10 次`
- 坏：`用户满意`
- 好：移出验收标准，记入 Outcome Metrics。

## Phase A：创建决策映射

在 `docs/dev/decision-map.md` 创建映射，追踪所有待决策问题（Ticket 含 slug / Blocked by / Status / Type / Question / Answer）。初始只创建 2–4 个前沿 Ticket，不试图穷举。

Ticket 类型：Grilling（与用户对话澄清，按 `@grilling` 协议推进）/ Prototype（低保真验证）。
Grilling 中需要查文档/代码/日志等 fact 时，派 sub-agent（如 `@researcher` 加载 `flow-research`）取回结论，不把可查的 fact 抛给用户，也不把 Research 单列为并列 Ticket 类型。

## Phase B：渐进式解决

- 处理 Grilling 型 Ticket 时**加载 `@grilling` 协议**：把待决策问题映射成 design tree，按 frontier（prerequisites 已敲定的问题）逐轮推进；每轮可包含多个已 unblocked 的 Ticket，每个问题编号并给出推荐答案（格式见 grilling skill）。
- **facts 不占用用户轮**：frontier 问题需要来自 environment 的 fact 时，派 sub-agent 去查；进行中的探索只阻塞其下游问题，不阻塞本轮其余 frontier。
- **decisions 属于用户**：沿决策树分支深入，逐轮敲定。追问技巧："然后呢？"（第 3 层才触及本质）、"如果不做这个会怎样？"（验证优先级）、"**谁用什么判断做对了？**"（逼出可观察判据与判定方法）。
- **Answer 必须带判据**：凡涉及产品行为、交互、边界、失败处理的决策，Answer 末尾追加一句 `验收：<外部可观察到什么结果>；判定：<命令/阈值/断言/目检>`。选型类/纯技术取舍可不附，但要说明其不直接产生用户可见行为。
- **验收本身就是前沿**：如果"做对了没有"无法回答，或答案仍是模糊词，**追加一个 Grilling Ticket 专门追问验收**（"完成后屏幕上/接口里会出现什么？""在哪个分辨率/数据下看？""出错时用户看到什么？"），直到可判定。
- 解决后 `Status: resolved` 并记录 Answer；用户回答会重塑 design tree——敲定的决策把 frontier 向外推，检查是否有新问题浮现 → 追加 Ticket。
- 循环直到 grilling 宣布 frontier 为空（design tree 每个分支都访问过、无默默假设），方可进入 Phase C。

## Phase C：凝固为 PRD

从 Decision Map 的 Answer 提炼为 PRD，保存到 `docs/prd/<title>.md`。PRD 可保留 Problem/Thesis/Hypothesis/范围/非目标/约束等章节，**但必须包含独立的「验收标准（Acceptance Criteria）」章节**，格式如下：

```markdown
## 验收标准（Acceptance Criteria）

> 每条可独立判定 pass/fail；必须含"判定：…"。模糊词需量化或降级为目检清单。

### <能力分组，如 对话生成 / 布局 / 失败与降级>
- [ ] Given <前提>，When <动作>，Then <可观察结果>；判定：<命令 | 阈值 | DOM/状态断言 | 目检清单>
- [ ] <边界/失败/降级行为>；判定：…

### 视觉/UX（如适用）
- [ ] 在 <分辨率断点> 下：<无缺陷清单，如无横向滚动/无文字截断/对比度≥…/浮层不遮挡主体>；判定：截图走查 + <可自动化部分>
- [ ] 确属审美、无法机检的项，标注 [人工目检] 并列出具体检查点（不得伪装成客观阈值）
```

### AC 质量自检（Phase C 出口闸，逐条过）

进入 Phase D 前必须全部满足；任一不通过 → 回 Phase B 补追验收 Ticket：

1. **零模糊词**：对 AC 文本扫描上方模糊词表，命中数为 0。
2. **每条有判定方法**：每条 AC 都含"判定：…"，且方法可在不依赖作者口头解释的情况下执行（具体命令、阈值数字、可定位的 DOM/状态/产物，或列全检查点的目检清单）。
3. **结果可观察**：每条 AC 的 Then 部分是外部可观察结果，不含"应该/适当/更好/尽量"。
4. **审美项诚实降级**：无法客观判定的视觉判断标 `[人工目检]` 并给出"分辨率 + 无缺陷清单"；禁止编造不可执行的假阈值。
5. **路径完整**：主路径、边界、失败/降级/空状态都有对应 AC，不只写 happy path。
6. **可下传**：每条 AC 都能被 `flow-design` 转成一个 Test Seam 或 `verify_commands`；若想不出怎么测，说明还不够具体 → 回 Phase B。

> 业务结果类指标放单独的「成功度量（Outcome Metrics，非验收）」节，并注明不作为完成判据。

## Phase D：创建 Parent Issue

用 gh 创建 Parent Issue（Flow Record），作为目标与验收标准的权威来源：

```bash
gh issue create --title "<英文功能标题>" --body "<目标 + 验收标准>"
```

- 标题使用英文功能短语（kebab-case），后续分支名、目录名以其为基准。
- Issue body 的验收 checklist **直接逐条复制 PRD 的可判定 AC**，保留其判定方法与阈值，不得浓缩或改写成"界面美观""体验流畅"等模糊短语。
- Outcome Metrics 不进入完成 checklist。

## CONTEXT.md 术语发现

需求澄清中发现的领域术语写入根 `CONTEXT.md`（术语权威）。发现新术语或冲突时暂停提问，用户确认后更新。

## Output
- `docs/dev/decision-map.md` — 决策映射（PRD 生成后可删除）
- `docs/prd/<title>.md` — PRD（含可判定「验收标准」章节）
- Parent Issue（Flow Record，body checklist 与 PRD AC 一致）

## 下一阶段
- **/design** — 基于 PRD 进行技术设计；每条 AC 对应一个 Test Seam 或 verify 手段

## Contract

### Trigger
由 `/requirements` 命令或 `@dev-lifecycle` 触发。

### Inputs
- 用户提供的功能描述（来自消息文本）

### Preconditions
- gh CLI 可用

### Procedure
1. 锚定核心问题，创建 Decision Map
2. 按 `@grilling` 协议渐进式解决所有前沿 Ticket（Grilling 轮次中需要的 facts 派 sub-agent 查；必要时插 Prototype 低保真验证）；产品行为类 Answer 必须附可判定判据，不够具体时追加验收 Ticket
3. 迷雾推至足够远 → 凝固为 PRD，写入独立「验收标准」章节
4. 执行 AC 质量自检（6 项）；未通过则回第 2 步补追验收，不得进入下一步
5. 记录领域术语到 CONTEXT.md
6. 用 gh issue create 创建 Parent Issue，body checklist 取自 PRD 的可判定 AC

### Outputs
- `docs/dev/decision-map.md`
- `docs/prd/<title>.md`（含可判定验收标准）
- Parent Issue（checklist 与 PRD AC 逐条对应）

### Failure
- gh 未认证 → 提示用户 `gh auth login` 后重试
- Issue 创建失败 → 记录错误，不阻塞 PRD 写入
- AC 含模糊词、缺判定方法、或仅写 happy path → 回 Phase B 追加验收 Ticket，不产出 PRD/Issue

### Idempotency
- Decision Map 已存在 → 从中断点继续
- PRD 文件已存在 → 更新而非覆盖；更新后重跑 AC 质量自检
- Parent Issue 已创建 → 复用其编号而非重复创建；AC 变化时用 `gh issue edit` 同步 checklist

### Prohibited Actions
- 不跳过 Phase A 和 Phase B 直接输出 PRD
- 不把可自行查到的 fact 抛给用户；不跳过 frontier 顺序问依赖未定的问题
- 不创建重复的 Parent Issue（复用已有编号）
- 不写无判定方法的验收标准，不用模糊词伪装可判定
- 不把 Outcome/业务结果指标混作验收标准或完成 checklist
- 不对无法机检的审美项编造客观阈值；应标 `[人工目检]` 并列检查点
