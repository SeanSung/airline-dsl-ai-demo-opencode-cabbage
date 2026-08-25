import { createModels } from '@earendil-works/pi-ai'
import { deepseekProvider } from '@earendil-works/pi-ai/providers/deepseek'
import type { StreamFn } from '@earendil-works/pi-agent-core'
import { SYSTEM_PROMPT } from './agent/system-prompt.js'
import { createSessionManager } from './agent/session.js'
import { createGenerateRouteTool } from './agent/tools.js'
import { loadConfig } from './config.js'
import { ConversationRepository, RouteRepository, openDb } from './store/index.js'
import { createApp } from './http/app.js'

const config = loadConfig(process.env)
const db = openDb(config.dbPath)
const store = new RouteRepository(db)
const conversations = new ConversationRepository(db)

const models = createModels()
models.setProvider(deepseekProvider())
const model = models.getModel('deepseek', config.deepseek.model) ?? models.getModels('deepseek')[0]
if (!model) {
  throw new Error(`deepseek provider 无可用模型，请检查 DEEPSEEK_MODEL=${config.deepseek.model}`)
}
const streamFn: StreamFn = (model, context, options) => models.streamSimple(model, context, options)

const sessionManager = createSessionManager({
  systemPrompt: SYSTEM_PROMPT,
  model,
  streamFn,
  tools: [],
  createRouteTool: () => createGenerateRouteTool({ store, limits: { heightLimitM: config.heightLimitM } }),
  store,
  llmFallbackEnabled: config.llmFallbackEnabled,
})

const app = createApp({
  sessionManager,
  routes: store,
  conversations,
  gbhBaseUrl: config.gbhBaseUrl,
  tiandituToken: config.tiandituToken,
})

const port = Number(process.env.PORT ?? 7002)
Bun.serve({
  port,
  fetch: (req) => app.fetch(req),
})
console.log(`airline-dsl server listening on :${port} (model: ${model.id}, llmFallbackEnabled: ${config.llmFallbackEnabled})`)
