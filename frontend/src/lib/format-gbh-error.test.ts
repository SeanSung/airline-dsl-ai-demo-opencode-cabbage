import { describe, expect, it } from 'vitest'
import { formatGbhError } from './format-gbh-error'

describe('formatGbhError', () => {
  it('JSON.stringify 的 errors 对象输出不含 { 与 "', () => {
    const errors = [{ path: 'waypoints.0', message: '高度超限' }]
    const out = formatGbhError(JSON.stringify(errors))
    expect(out).not.toContain('{')
    expect(out).not.toContain('"')
    expect(out).toContain('高度超限')
  })

  it('数组中多个 message 用中文分号拼接且不含 JSON 字符', () => {
    const out = formatGbhError([
      { path: 'waypoints.0', message: '高度超限' },
      { path: 'waypoints.1', message: '速度过快' },
    ])
    expect(out).not.toContain('{')
    expect(out).not.toContain('"')
    expect(out).toContain('高度超限')
    expect(out).toContain('速度过快')
  })

  it('Error 实例取 message 并净化其中的 JSON', () => {
    const out = formatGbhError(new Error('平台返回 detail 炸了'))
    expect(out).not.toContain('{')
    expect(out).not.toContain('"')
    expect(out).toContain('平台返回')
  })

  it('undefined 返回兜底文案', () => {
    const out = formatGbhError(undefined)
    expect(out).toBe('提交失败，请稍后重试')
    expect(out).not.toContain('{')
  })

  it('null 返回兜底文案', () => {
    expect(formatGbhError(null)).toBe('提交失败，请稍后重试')
  })

  it('网络错误识别为检查网络提示', () => {
    expect(formatGbhError(new TypeError('Failed to fetch'))).toBe(
      '提交失败，请检查网络后重试',
    )
  })

  it('无 message 的空对象返回校验失败提示', () => {
    expect(formatGbhError({})).toBe('航线校验未通过，请检查航点参数')
  })

  it('无 message 的数组返回校验失败提示', () => {
    expect(formatGbhError([])).toBe('航线校验未通过，请检查航点参数')
  })

  it('字符串直接作为文案且被净化', () => {
    const out = formatGbhError('平台校验失败：高度超限')
    expect(out).toBe('平台校验失败：高度超限')
  })

  it('超长文案被截断', () => {
    const long = 'A'.repeat(300)
    const out = formatGbhError(long)
    expect(out.length).toBeLessThanOrEqual(161)
    expect(out.endsWith('…')).toBe(true)
  })
})
