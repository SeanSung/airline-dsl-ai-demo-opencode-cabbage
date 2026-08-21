import type { AirlineContent } from '@airline-dsl/shared'

export type SubmitResult =
  | { status: 'ok'; routeId: string }
  | { status: 'invalid'; errors: unknown }
  | { status: 'error'; message: string }

export interface SubmitRouteOptions {
  baseUrl: string
  fetch?: typeof fetch
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 10_000

async function readBody(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function submitRoute(
  content: AirlineContent,
  opts: SubmitRouteOptions,
): Promise<SubmitResult> {
  const doFetch = opts.fetch ?? globalThis.fetch
  try {
    const res = await doFetch(`${opts.baseUrl}/api/open/routes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(content),
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
    if (res.status === 201) {
      const body = (await readBody(res)) as { routeId?: string } | null
      return { status: 'ok', routeId: body?.routeId ?? '' }
    }
    if (res.status === 400) {
      const body = (await readBody(res)) as { errors?: unknown } | null
      return { status: 'invalid', errors: body?.errors ?? body ?? '' }
    }
    const body = (await readBody(res)) as { message?: string } | null
    return { status: 'error', message: body?.message ?? `HTTP ${res.status}` }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}
