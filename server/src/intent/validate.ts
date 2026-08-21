import { REQUIRED_INTENT_PARAMS, type Intent } from '@airline-dsl/shared'

export function validateIntentParams(
  partial: Partial<Intent>,
): { ok: true } | { ok: false; missing: string[] } {
  const missing = [...REQUIRED_INTENT_PARAMS].filter((key) => partial[key] === undefined)
  return missing.length > 0 ? { ok: false, missing } : { ok: true }
}
