import Type, { type TObject, type TSchema } from 'typebox'
import type { AgentTool } from '@earendil-works/pi-agent-core'
import { DEFAULT_COUNT, type AirlineContent, type Intent } from '@airline-dsl/shared'
import { intentSchema, validateIntentParams, mergeIntent, applyDefaults } from '../intent/index.js'
import { orbitWaypoints } from '../geometry/orbit.js'
import { buildAirlineContent, validateAirlineContent, type ValidationLimits } from '../airline/index.js'
import type { RouteRepository } from '../store/index.js'
import { AirlineValidationError, MissingIntentParamsError } from './errors.js'

export const GENERATE_ROUTE_TOOL = 'generate_route'

export interface GenerateRouteDetails {
  routeId: string
  intent: Intent
  content: AirlineContent
}

export interface GenerateRouteToolOptions {
  store: RouteRepository
  limits?: ValidationLimits
}

function partialObject(schema: TObject): TObject {
  const properties: Record<string, TSchema> = {}
  for (const [key, value] of Object.entries(schema.properties)) {
    properties[key] = Type.Optional(value as TSchema)
  }
  return Type.Object(properties)
}

const generateRouteParameters = partialObject(intentSchema)

export function createGenerateRouteTool(options: GenerateRouteToolOptions): AgentTool<any> {
  let draft: Partial<Intent> = {}

  return {
    name: GENERATE_ROUTE_TOOL,
    description: '根据已提取的意图参数生成大疆环绕航线并落库',
    label: '生成航线',
    parameters: generateRouteParameters,
    execute: async (_toolCallId, params) => {
      const merged = mergeIntent(params as Partial<Intent>, draft)
      draft = merged
      const validation = validateIntentParams(merged)
      if (!validation.ok) {
        throw new MissingIntentParamsError(validation.missing)
      }
      const intent = applyDefaults(merged as Intent)
      const content = buildAirlineContent(intent, (it) =>
        orbitWaypoints({ center: it.center, radiusM: it.radiusM, count: it.count ?? DEFAULT_COUNT }),
      )
      const airlineResult = validateAirlineContent(content, options.limits)
      if (!airlineResult.ok) {
        throw new AirlineValidationError(airlineResult.errors)
      }
      const route = options.store.create({
        name: content.name,
        intent,
        content,
        aiGenerated: true,
        status: 'draft',
      })
      draft = {}
      return {
        content: [
          {
            type: 'text',
            text: `航线已生成：${content.name}，共 ${content.waypoints.length} 个航点，routeId=${route.id}`,
          },
        ],
        details: { routeId: route.id, intent, content },
      }
    },
  }
}
