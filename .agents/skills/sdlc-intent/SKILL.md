---
name: sdlc-intent
description: 把一个想法（发起人口述、ticket、告警、文档等任何输入）打磨成可评审的 intent.md 提案并提交到共享仓库，供产品负责人接受或拒绝——立项前的轻量提案，不含实现方案。所有输入统一跑 per-axis 分诊：以 grilling 为骨架，空节点调用 creative-ideation 发散，开放取舍调用 structured-decisions 收敛，发起人已承诺的高利害方向用 steelman 压测；无实时发起人时用 autonomous/solo 引擎并标注推断；沉淀出的问题域术语/边界决策经 domain-modeling 写入 CONTEXT.md 与产品/范围类 ADR（不写技术 ADR），所有产物随 intent 的 PR 分支提交，拒绝即丢弃。
disable-model-invocation: true
---

# To Intent

把一份输入打磨成可评审的 `intent.md` 提案并提交。输入可能是发起人口述的一个模糊痛点、一份 ticket、一组告警、或一份文档。你的角色是编排者，不是记录员：以 `grilling` 为骨架组织问题树，空白处用 `creative-ideation` 爆发可能性，开放取舍处用 `structured-decisions` 给带理由的推荐，已锁定的高利害方向用 `steelman` 真诚压测。有实时发起人时判断权在发起人；没有时你按引擎产出草稿并标注所有推断，交产品负责人评审裁决。这是立项前的轻量提案：只说问题、结果、范围与约束；实现方案、user stories、测试计划是产品负责人接受之后的事。

提案的治理记录就是提交到 git 的 `intent.md` 本身：作者与时间戳来自 commit，修订历史来自 `git log`。

## 入口

输入可以是任何东西：发起人口述的一个想法、一份 ticket（Jira/GitHub Issues/支持台）、一组告警与事故排查材料、一份文档或对话记录。**不按来源分类，也不因来源跳过步骤。** 所有输入都进入步骤 1 的 per-axis 分诊——材料里写清楚的 axis 标"有但模糊"直接核对，空白的 axis 才驱动引擎选择。

唯一影响处理方式的变量是**有没有一个能实时对话的发起人**：有则用 grilling frontier 提问萃取（发起人主火）；没有则按"认知引擎边界"第 5 条用 autonomous creative-ideation 补框定、solo structured-decisions 过冷水，所有推断内容显式标注，交产品负责人在步骤 4 纠正。

## Process

### 1. 摸清形状 + 逐轴分诊

先抓四样东西：今天做不到什么（附事实和影响）、谁受影响、更好的样子、什么明确不在范围内。有实时发起人时，让他用自己的话描述，不要要求正式语言；发起人有现成材料（文档、ticket、对话记录）就读取，但以发起人口述为准。没有实时发起人时，直接从手头材料提取这四项，提取不到的标为空白 axis，由步骤 2 的引擎补。

然后**按 intent.md 的六个 axis 逐个判定状态**，不要做全局"成熟/不成熟"二分——一个提案的问题可能很清楚，但成功标准一片空白。每个 axis 标一种状态，决定步骤 2 在该轴上跑哪个引擎：

| axis（intent.md section） | 空/模糊 → creative-ideation | 有但模糊 → grilling（默认） | 多候选需取舍 → structured-decisions |
|---|---|---|---|
| Problem | 痛点说不清、需要重构框定 | 能说出哪里痛，补事实与影响 | 两个问题框定互斥且影响后续一切 |
| Proposed outcome | "更好的样子"空白 | 有方向，提炼成可观察结果 | 有 2-3 个 outcome 方向必须选一个 |
| Success criteria | 不知道怎么观察生效 | 有信号，逐个确认可衡量性 | 信号互相冲突需定优先级 |
| Affected users/systems | 漏掉隐性受影响方，换角度找 | 点名角色与系统，补次要方 | — |
| Constraints | 主动抛被忽略的约束类型（PII/鉴权/SLA/历史数据） | 逐条确认哪些成立 | 硬约束互相冲突需取舍 |
| Out of scope | — | 列相邻但这次不做的切法 | 边界本身就是 A/B/C 决策 |

**完成：** 四项基本信息到手（或显式标为空白待补）；六个 axis 各有状态标记。有实时发起人则与其对齐，没有则标注哪些是材料所载、哪些是推断。缺事实就追问（有人可问时）或自己查（边界见第 2 条），不要替发起人编。

### 2. 磨到可评审

以 `grilling` 的 design tree 跑这六个 axis：每个 axis 分支到它下面的子问题；**frontier** 是 prerequisite 已敲定、现在就能问的问题。有实时发起人时，一轮问完整条 frontier——每个问题编号、附你的推荐答案（`❓ Q1 - 标题：正文 ➡️ 推荐答案`），等发起人回答，再重新算 frontier 进入下一轮。需要来自环境的 fact 时自己查或派 sub-agent，不要问发起人你能查到的东西（查的边界见"认知引擎边界"第 2 条）。没有实时发起人时，grilling 只用来组织 design tree 结构，frontier 问题无人可问——按第 5 条交给引擎或自己查材料，查不到的记为 open questions。

三个切换点，按 axis 状态或发起人姿态触发：

- **空/模糊节点 → 切 `creative-ideation`。** time-boxed：只跑 1–2 批技法（每批 3–4 个，跨类别组合），不追 100 个想法；产出候选池后回到 design tree 逐个核对。有实时发起人时默认用 facilitator 或 partner 姿态（发起人主火）；没有时用 autonomous 姿态从材料生成框定，所有产出标注为推断（见第 5 条）。
- **开放取舍 → 切 `structured-decisions`。** 方向还没定、需要 2-3 个真不同的选项时用它。默认只跑冷水检验 + 2-3 选项 + 带理由的推荐，**跳过**二次采样/决策圆桌/外部校准——除非发起人明确要深挖，或某个取舍在提案阶段就难以逆转（罕见；多数技术难逆转决策在接受后）。有实时发起人时它给推荐、发起人拍板（见第 3 条）；没有时跑 solo 模式，推荐交产品负责人在步骤 4 裁。
- **发起人已承诺的高利害方向 → 切 `steelman`。** 当发起人已经选定一个方向（不是开放选型），且方向涉及产品定位、范围边界、商业模式、战略 pivot 或难逆转承诺时，用 steelman 真诚论证 2-3 个最强替代方案，再让发起人决定 Proceed/Reconsider/Investigate。不自动触发——可以建议，由发起人发起。不要把 steelman 用在例行实现细节或已充分探索过的选择上。

想法已经成型时（六个 axis 全落在"有但模糊"列），这一步退化成 grilling 快速核对：逐条确认，有缺口才追问，不要为走流程强行发散。

目标不是回答所有问题，而是让意图**可评审**：产品负责人无需再次对话发起人就能接受或拒绝。真正暂时无法确定的，显式记成 open questions，不要含糊带过。此阶段不深入 codebase 方案域（边界见下节第 2 条）；但沉淀出的问题域术语、边界关系和值得记的产品/范围决策应**当场**写入 `CONTEXT.md` 或 ADR（见下节第 1 条）。

**完成：** 你能清晰陈述问题、结果与范围，让产品负责人据此拍板；有实时发起人时每条内容经其确认，没有时每条内容标注来源（材料所载/推断/open question）；剩余未知已显式列入 open questions。

### 3. 起草 intent.md

确定一个简短 slug（kebab-case；中文标题用简洁的英文或拼音 slug），确认未被 `docs/intents/` 下已有 intent 占用。有实时发起人时与其确认；没有时从材料标题或 Problem 自行拟定，并在草稿里标注待产品负责人确认。写到 `docs/intents/<slug>.md`，目录不存在则创建。

模板：仓库中存在 `docs/agents/intent-template.md`（技术团队维护、经 PR 签字）时使用它；否则使用本 skill 附带的 [intent-template.md](intent-template.md) 内置模板。

作者用 `git config user.name` 预填，有实时发起人时与其确认；没有时填工单作者/值班人（可从材料推断），推断不出则留空标注待补。Status 写 `draft`。

**完成：** 文件已写入，每个 section 已填写或显式标注 `N/A`，没有 `TODO`、`<...>` 等占位符残留。

### 4. 纠正

把完整草稿展示给确认人，请其指出被误解或遗漏的地方。按反馈修改，重复直到确认准确。

有实时发起人时，确认人就是发起人。没有实时发起人时（从 ticket、告警、文档等材料起草），跳过实时纠正环，直接进入步骤 5 提交——把纠正交给产品负责人在 PR 评审时做；草稿中所有推断内容必须显式标注，便于产品负责人识别哪些需要核对。

**完成：** 有实时发起人时，发起人明确确认草稿反映其意图；没有时，草稿已提交并标注所有推断点，产品负责人的评审即是纠正环节。

### 5. 提交

把 Status 改为 `submitted`，提交到 git：

git add docs/intents/<slug>.md CONTEXT.md docs/adr/
git commit -m "intent: <title>"
```

作者与时间戳即写入 commit 记录。若当前在分支上且有 remote，push 并用 `gh pr create`（如可用）开一个标题为 `intent: <title>` 的 PR 交产品负责人评审；否则告诉发起人下一步开 PR 的命令。

**完成：** `intent.md` 已在 git 历史中；你已向发起人报告文件路径、commit 与评审下一步。

## 认知引擎边界

这五个裁决贯穿步骤 1–2，防止四个引擎互相踩脚或越界。
1. **问题域术语当场持久化；技术决策不写。** intent 阶段的认知产物分两类：**问题域**（谁是 sponsor/用户、业务边界、术语含义、范围切分）和**方案域**（架构、模块、技术选型）。问题域决策一旦在对话中确定，**当场**经 `domain-modeling` 写入 `CONTEXT.md`；满足 ADR 三条件（难逆转、没上下文会令人惊讶、真实权衡）的产品/范围/边界决策写成 ADR（例如"我们只服务内部 sponsor，不做外部付费方"）。**不写技术/架构 ADR**——那需要方案探索，属于接受后。所有 CONTEXT.md/ADR 改动与 intent.md 在**同一条分支、同一次提交/PR**上：产品负责人接受 PR 则术语一起进 main，拒绝则整枝丢弃，不存在污染 main 的风险。不要把更新攒到最后；术语解决就内联写入。

2. **codebase 探索划在问题域。** grilling 要求 facts 自己查，但在 intent 阶段只查**问题域**事实：已有 intents、文档、ticket、事故报告、dashboard、README/`CONTEXT.md`（了解产品上下文）。**不查方案域**：架构、模块设计、实现细节——那是接受后的活。判据：能 grounding"今天哪里错/谁受影响/现状 workaround"的查；预设"怎么建"的不查。保持轻，服从先行指标（数小时不是数周）。

3. **两级决策权。** `structured-decisions` 产出"恰好一个推荐项"，但步骤 2 的拍板人是**提案的拥有者**：有实时发起人时是发起人（这是他的提案，措辞用"我推荐 X，因为…，你定"）；没有实时发起人时是产品负责人，在步骤 4 的 PR 评审中裁决。无论哪种情况，都不要把你的推荐偷渡成已定内容写进 intent.md——没有经拥有者明确确认的，必须标注为推荐或推断。

4. **深度服从可评审。** 发散与收敛引擎都 time-box 到"让 intent 可评审"即停：`creative-ideation` 不追 100 想法，`structured-decisions` 不上圆桌/外部校准，`steelman` 只在有实时发起人且其已承诺一个高利害方向时用一次（没有实时发起人时无承诺方向可压测，不用 steelman）。可评审就停，不要过度打磨。

5. **无实时发起人时 grilling 只做骨架，不做访谈。** grilling 的 design tree/frontier 结构始终用来组织六个 axis 的问题树；但 frontier 提问需要一个能回答的活人。没有实时发起人时，不要把问题挂起等人——能用问题域材料（ticket、告警、已有 intents、文档、`CONTEXT.md`、dashboard）回答的自己查或派 sub-agent；材料里没有的空白 axis，用 `creative-ideation` 的 **autonomous 姿态**生成候选框定，再用 `structured-decisions` **solo**（无第二方拍板）给草稿过冷水；所有你推断或生成的内容显式标注为"推断"，未确认的列入 open questions，交产品负责人在步骤 4 评审时裁决。

## Intent template

内置模板随 skill 提供：[intent-template.md](intent-template.md)。起草 `docs/intents/<slug>.md` 时直接复制该文件内容并填写；组织若放置了 `docs/agents/intent-template.md`，则优先使用组织模板（见下方 Org template override）。

## Governance

- **记录即提交的文件。** 作者、时间戳、修订历史全部来自 git，不要另建 index 或台账——目录列表加 `git log` 就是记录。
- **产品负责人的决定**记录在评审上：接受 = 合并 PR（进入阶段 2，Status 改 `accepted`，之后可用 `@to-spec` 产出工程 spec）；拒绝 = 关闭评审（Status 改 `rejected`，附理由）。
- **指标**解释流程为何追求快，不需要你计算：
  - 先行指标：首次对话到提交 `intent.md` 的时间（从 git 历史读取）——目标是数小时，不是数周。所以可评审就提交，不要过度打磨。
  - 滞后指标：`intent.md` 被接受进入阶段 2 的比率；以及同一变更首次提交 `spec.md` 之后对 `intent.md` 的修改次数——该数字越高，说明意图在进入设计前越不具体。

## Org template override

技术团队可在 `docs/agents/intent-template.md` 放置组织模板，替代内置模板。该文件经 PR 批准即视为负责人签字；存在时本 skill 直接使用，不再询问。

## 一次性基础设施（平台/工程团队）

发起人使用本 skill 前，平台或工程团队需完成一次设置；已设置则跳过本节。

- **非工程师的 Claude 接入** — claude.ai 或 Cowork，让发起人不依赖本地工程环境。
- **共享的 intent home** — 单产品用产品仓库内的 `docs/intents/` 目录，让 artifact 链紧挨由此衍生的代码；monorepo 中同样是目录；只有当 intent 跨多个仓库时才值得独立建 intent 仓库。
- **写权限** — 确定谁能向 intent home 提交（跨组织贡献者会多）。
- **VCS connector** — 让 Claude 代表不熟悉 git 的发起人，直接从 claude.ai/Cowork 提交 markdown（如 GitHub connector）。
- **Intent 模板** — 用 `docs/agents/intent-template.md` 落地组织模板（见 Org template override），由技术团队编写、负责人签字。
- **与现有需求工具的关系** — 若 Jira 等系统已是记录系统，intent home 作为前置 artifact 链；阶段 3 Build 负责与该工具的衔接，不在本 skill 内处理。
