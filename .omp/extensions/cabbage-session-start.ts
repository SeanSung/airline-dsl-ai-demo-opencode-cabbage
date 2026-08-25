/**
 * Cabbage Session Start hook (omp port).
 *
 * Native port of @devcxl/opencode-cabbage's Codex SessionStart hook
 * (source: ~/project/opencode-cabbage/src/hooks/session-start.ts; declared in
 * hooks/hooks.json with matcher "startup|resume"). omp does not parse Codex
 * hooks.json, so this registers as an omp extension module and injects the
 * plugin banner + project profile once per session via the session_start
 * event. Loaded automatically from .omp/extensions/ by Bun (no build step).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const MAX_OUTPUT_LENGTH = 12000;
const CUSTOM_TYPE = "cabbage-session-start";

/**
 * Bun caches this module by resolved path across every ExtensionRunner in the
 * process (main session + in-process subagents). The Codex matcher is
 * "startup|resume" — inject exactly once per process/session tree, not once
 * per subagent. Subagents inherit the parent's context regardless.
 */
let injected = false;

function getHeader(): string {
	return `## Cabbage Development Plugin

This plugin provides a full development lifecycle orchestration system.
Load skills by name: @dev-lifecycle, @architect, @developer, @reviewer, @goal-verify, @researcher

### Available Flow Skills
- \`@flow-setup\` — 初始化项目开发环境
- \`@flow-requirements\` — 需求分析产出 PRD
- \`@flow-design\` — 技术方案与 ADR
- \`@flow-tasks\` — DAG 任务拆解
- \`@flow-research\` — 调研/事实核查
- \`@flow-code\` — 编码实现（TDD）
- \`@flow-tdd\` — TDD 协议参考
- \`@flow-review\` — 代码审查
- \`@flow-release\` — 发布流程

### Available Agent Skills
- \`@dev-lifecycle\` — 全流程编排器（主 agent，场景分诊）
- \`@architect\` — 架构设计
- \`@developer\` — 编码实现
- \`@reviewer\` — 代码审查
- \`@goal-verify\` — 目标验证
- \`@researcher\` — 独立调研
`;
}

/**
 * Read the "## Project Profile" section of <cwd>/AGENTS.md. Matches only the
 * exact heading line (rejecting e.g. "## Project Profile Notes") and stops at
 * the next level-2 heading or EOF. Returns "" when the file or section is
 * absent or unreadable.
 */
function readProjectProfile(cwd: string): string {
	const agentsMd = join(cwd, "AGENTS.md");
	if (!existsSync(agentsMd)) return "";

	let content: string;
	try {
		content = readFileSync(agentsMd, "utf8");
	} catch {
		return "";
	}

	const lines = content.split("\n");
	const start = lines.findIndex(line => line.trim() === "## Project Profile");
	if (start === -1) return "";

	const end = lines.findIndex((line, i) => i > start && /^##\s/.test(line.trim()));
	const slice = end === -1 ? lines.slice(start) : lines.slice(start, end);
	return slice.join("\n").trim();
}

function buildOutput(cwd: string): string {
	const header = getHeader();
	const profile = readProjectProfile(cwd);

	const parts = [header];
	if (profile) parts.push(`## Project Context\n\n${profile}`);

	let output = parts.join("\n\n");
	if (output.length > MAX_OUTPUT_LENGTH) {
		output = `${output.slice(0, MAX_OUTPUT_LENGTH)}\n\n[context truncated — output exceeds ${MAX_OUTPUT_LENGTH} chars]`;
	}
	return output;
}

export default function (pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => {
		if (injected) return;
		injected = true;

		const content = buildOutput(ctx.cwd);
		if (!content) return;

		// deliverAs: "nextTurn" keeps the message out of the editable
		// pending-message UI and queues it for the first agent turn; it is
		// persisted to session history (survives compaction), matching the
		// Codex stdout-injection-at-startup semantics.
		pi.sendMessage(
			{ customType: CUSTOM_TYPE, content, display: true, attribution: "agent" },
			{ deliverAs: "nextTurn" },
		);
	});
}
