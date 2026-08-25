import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 设计 token 回归门（对应 PRD §7.5）：
 * - JSX inline `style={{ ... }}` 出现次数为 0（白名单仅 Cesium 命令式实体图形属性，逐处注释）。
 * - `components/ui` 与 token 文件之外的硬编码颜色字面量（#xxx / rgb() / rgba()）计数为 0。
 *   Cesium 运行时实体颜色（src/lib/cesium-entities.ts 及其测试）为 PRD 显式白名单。
 *
 * 这两个约束是「无第二套圆角/配色」的唯一可在 CI 中断言的代理；
 * 两分辨率目检与对比度 ≥4.5:1 仍属 demo 环境 door-check（PRD 第 10 节）。
 */

const SRC = join(__dirname, '..')

const COLOR_RE = /#([0-9a-fA-F]{3,8})\b|rgba?\(/
// 允许出现硬编码颜色字面量的白名单文件（Cesium 命令式实体图形属性）
// 路径相对于 src（与 rel() 输出一致）。*.test.* 不纳入扫描（PRD 门仅针对业务组件）。
const COLOR_WHITELIST = ['lib/cesium-entities.ts']

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.') && name !== '.') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\.(tsx?|jsx?)$/.test(name)) out.push(full)
  }
  return out
}

function rel(p: string): string {
  return p.replace(SRC + '/', '')
}

describe('设计 token 一致性回归（PRD §7.5）', () => {
  const files = walk(SRC)

  it('JSX inline style={{ ... }} 出现次数为 0', () => {
    const hits: string[] = []
    for (const f of files) {
      const lines = readFileSync(f, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (line.includes('style={{')) hits.push(`${rel(f)}:${i + 1}`)
      })
    }
    expect(hits, `发现 inline style: ${hits.join(', ')}`).toHaveLength(0)
  })

  it('token/components/ui 之外无硬编码颜色字面量', () => {
    const hits: string[] = []
    for (const f of files) {
      const r = rel(f)
      if (COLOR_WHITELIST.includes(r)) continue
      const lines = readFileSync(f, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (COLOR_RE.test(line)) hits.push(`${r}:${i + 1} -> ${line.trim()}`)
      })
    }
    expect(hits, `发现硬编码颜色: ${hits.join(' | ')}`).toHaveLength(0)
  })
})
