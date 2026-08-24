/**
 * GBH 提交失败原因 → 中文用户提示。
 *
 * 设计目标：
 * 1. 不向前端泄露原始 JSON 结构（输出绝不包含 `{` 或 `"`）。
 * 2. 表驱动识别常见错误：网络异常、校验失败、平台 message。
 * 3. 任意入参（Error / 字符串 / 数组 / 对象 / JSON 字符串 / undefined）都有兜底文案。
 */

/** 用户可见文案最大长度，超出截断，避免超长错误撑爆浮卡。 */
const MAX_MESSAGE_LEN = 160

/** 网络类错误关键字（小写匹配），命中则提示检查网络。 */
const NETWORK_HINTS = [
  'failed to fetch',
  'load failed',
  'networkerror',
  'network request failed',
  'timeout',
  'aborted',
  'socket',
]

const VALIDATION_FALLBACK = '航线校验未通过，请检查航点参数'
const UNKNOWN_FALLBACK = '提交失败，请稍后重试'
const NETWORK_FALLBACK = '提交失败，请检查网络后重试'

/** 从任意入参中尽力提取人类可读的 message 字符串。 */
function extractMessage(input: unknown): string | null {
  if (input == null) return null

  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return extractMessage(JSON.parse(trimmed))
      } catch {
        return input
      }
    }
    return input
  }

  if (input instanceof Error) return input.message

  if (Array.isArray(input)) {
    const parts = input
      .map((item) => extractMessage(item))
      .filter((m): m is string => !!m)
    return parts.length > 0 ? parts.join('；') : null
  }

  if (typeof input === 'object') {
    const candidate = (input as { message?: unknown }).message
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate
  }

  return null
}

/** 净化文案：移除会泄露 JSON 结构的字符，并把英文双引号替换为中文引号。 */
function sanitize(text: string): string {
  return text
    .replace(/[{}\\]/g, '')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** 截断超长文案。 */
function truncate(text: string): string {
  if (text.length <= MAX_MESSAGE_LEN) return text
  return `${text.slice(0, MAX_MESSAGE_LEN)}…`
}

/** 判断 message 是否为网络类错误。 */
function isNetworkError(message: string): boolean {
  const lower = message.toLowerCase()
  return NETWORK_HINTS.some((hint) => lower.includes(hint))
}

/**
 * 把 GBH 提交失败的任意原因格式化为中文用户提示。
 * 输出保证：不含字符 `{` 与 `"`，且为非空字符串。
 */
export function formatGbhError(input: unknown): string {
  const message = extractMessage(input)

  if (message) {
    if (isNetworkError(message)) return NETWORK_FALLBACK
    const safe = truncate(sanitize(message))
    if (safe.length > 0) return safe
  }

  if (Array.isArray(input) || (input != null && typeof input === 'object')) {
    return VALIDATION_FALLBACK
  }

  return UNKNOWN_FALLBACK
}
