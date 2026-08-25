import type { AgentEvent, AirlineContent, Intent } from '@airline-dsl/shared'
import { toUIMessageChunk, type UIMessageChunk, type UIDataTypes } from 'ai'

/**
 * Data types for airline-specific typed data chunks.
 * Keys map to chunk type `data-<name>`.
 */
export interface AirlineDataTypes extends UIDataTypes {
  'airline-route': {
    routeId: string
    content: AirlineContent
    intent: Intent
    aiGenerated: boolean
  }
  'airline-clarification': {
    missing: string[]
  }
}

export type AirlineUIMessageChunk = UIMessageChunk<unknown, AirlineDataTypes>

/** Context passed to the pure mapping function. */
export interface AgentEventContext {
  routeId?: string
}

/**
 * Build text-start/text-delta/text-end chunks via the ai package helper
 * (canonical protocol shapes; never hand-written literals).
 */
function textSegmentChunks(text: string): AirlineUIMessageChunk[] {
  const id = crypto.randomUUID()
  return [
    toUIMessageChunk({ type: 'text-start', id }),
    toUIMessageChunk({ type: 'text-delta', id, text }),
    toUIMessageChunk({ type: 'text-end', id }),
  ].filter((chunk): chunk is AirlineUIMessageChunk => chunk !== undefined)
}

/**
 * Pure function: maps a single AgentEvent to a sequence of UIMessageChunk.
 *
 * Observable contract (spec §3.1 T1):
 * - text_delta → text-start + text-delta + text-end
 * - route_generated → data-airline-route data chunk
 * - error → error chunk (errorText = message)
 * - clarification → data-airline-clarification data chunk + text segment
 * - done → finish chunk
 */
export function agentEventToChunks(
  ev: AgentEvent,
  _ctx: AgentEventContext = {},
): AirlineUIMessageChunk[] {
  switch (ev.type) {
    case 'text_delta': {
      return textSegmentChunks(ev.text)
    }

    case 'route_generated': {
      // ai 包对 data chunk 无运行时助手，用 DataUIMessageChunk 类型（经 AirlineUIMessageChunk）约束形状。
      const routeData: AirlineDataTypes['airline-route'] = {
        routeId: ev.routeId,
        content: ev.content,
        intent: ev.intent,
        aiGenerated: ev.aiGenerated,
      }
      return [
        {
          type: 'data-airline-route',
          data: routeData,
        } satisfies AirlineUIMessageChunk,
      ]
    }

    case 'error': {
      const chunk = toUIMessageChunk(
        { type: 'error', error: new Error(ev.message) },
        { onError: () => ev.message },
      )
      return chunk ? [chunk] : []
    }

    case 'clarification': {
      const chunks: AirlineUIMessageChunk[] = []
      chunks.push({
        type: 'data-airline-clarification',
        data: { missing: ev.missing },
      } satisfies AirlineUIMessageChunk)
      const text = ev.text ?? `待补充参数：${ev.missing.join('、')}`
      chunks.push(...textSegmentChunks(text))
      return chunks
    }

    case 'done': {
      // toUIMessageChunk 的 finish part 需要服务端 totalUsage 字段（TextStreamFinishPart）；
      // 此处用 DataUIMessageChunk/类型约束的字面量，协议字段仍由 AirlineUIMessageChunk 把关。
      return [
        {
          type: 'finish',
          finishReason: 'stop',
        } satisfies AirlineUIMessageChunk,
      ]
    }
  }
}

/**
 * Options for sseResponseToChunkStream.
 */
export interface SseToChunkStreamOptions {
  onRoute?: (route: AirlineDataTypes['airline-route']) => void
  signal?: AbortSignal
}

/**
 * Transforms a ReadableStream<Uint8Array> SSE byte stream into a
 * ReadableStream<AirlineUIMessageChunk>.
 *
 * Handles SSE `data:` prefix stripping, multi-line buffering,
 * empty line skipping, abort signal, and onRoute callback.
 */
export function sseResponseToChunkStream(
  body: ReadableStream<Uint8Array> | null,
  opts: SseToChunkStreamOptions = {},
): ReadableStream<AirlineUIMessageChunk> {
  if (!body) {
    return new ReadableStream({
      start(controller) {
        controller.close()
      },
    })
  }

  const { onRoute, signal } = opts
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  return new ReadableStream<AirlineUIMessageChunk>({
    async start(controller) {
      if (signal) {
        signal.addEventListener('abort', () => {
          try { reader.cancel() } catch { /* already closed */ }
          controller.close()
        }, { once: true })
      }

      try {
        while (true) {
          if (signal?.aborted) break

          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Split on double newline (SSE event boundary)
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''

          for (const part of parts) {
            if (signal?.aborted) break
            const chunks = parseSseEvent(part, onRoute)
            for (const chunk of chunks) {
              controller.enqueue(chunk)
            }
          }
        }

        // Process remaining buffer (last event without trailing \n\n)
        if (buffer.trim() && !signal?.aborted) {
          const chunks = parseSseEvent(buffer, onRoute)
          for (const chunk of chunks) {
            controller.enqueue(chunk)
          }
        }
      } catch (err) {
        if (!signal?.aborted) {
          controller.error(err)
          return
        }
      } finally {
        controller.close()
      }
    },
  })
}

/** Parse a single SSE event block into UIMessageChunk[]. */
function parseSseEvent(
  block: string,
  onRoute?: (route: AirlineDataTypes['airline-route']) => void,
): AirlineUIMessageChunk[] {
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('data: ')) {
      dataLines.push(line.slice(6))
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5))
    }
  }

  if (dataLines.length === 0) return []

  const jsonStr = dataLines.join('\n')
  if (!jsonStr.trim()) return []

  let ev: AgentEvent
  try {
    ev = JSON.parse(jsonStr) as AgentEvent
  } catch {
    return []
  }

  const chunks = agentEventToChunks(ev)

  if (ev.type === 'route_generated' && onRoute) {
    onRoute({
      routeId: ev.routeId,
      content: ev.content,
      intent: ev.intent,
      aiGenerated: ev.aiGenerated,
    })
  }

  return chunks
}
