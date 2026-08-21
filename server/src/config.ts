import { DEFAULT_HEIGHT_LIMIT_M } from '@airline-dsl/shared'

export interface DeepSeekConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface AppConfig {
  dbPath: string
  gbhBaseUrl: string
  deepseek: DeepSeekConfig
  tiandituToken: string
  llmFallbackEnabled: boolean
  heightLimitM: number
}

const DEFAULT_DB_PATH = 'data/airline.db'
const DEFAULT_GBH_BASE_URL = 'http://localhost:5175'
const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat'

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const apiKey = env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('缺失必填环境变量 DEEPSEEK_API_KEY')
  }

  return {
    dbPath: env.DB_PATH ?? DEFAULT_DB_PATH,
    gbhBaseUrl: env.GBH_BASE_URL ?? DEFAULT_GBH_BASE_URL,
    deepseek: {
      baseUrl: env.DEEPSEEK_BASE_URL ?? DEFAULT_DEEPSEEK_BASE_URL,
      apiKey,
      model: env.DEEPSEEK_MODEL ?? DEFAULT_DEEPSEEK_MODEL,
    },
    tiandituToken: env.TIANDITU_TOKEN ?? '',
    llmFallbackEnabled: parseBoolean(env.LLM_FALLBACK_ENABLED, true),
    heightLimitM: parsePositiveInt(env.HEIGHT_LIMIT_M, DEFAULT_HEIGHT_LIMIT_M),
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`非法布尔值环境变量 LLM_FALLBACK_ENABLED: ${value}`)
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`非法正整数环境变量 HEIGHT_LIMIT_M: ${value}`)
  }
  return parsed
}
