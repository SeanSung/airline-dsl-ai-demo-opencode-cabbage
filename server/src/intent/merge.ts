import type { Intent } from '@airline-dsl/shared'

export function mergeIntent(partial: Partial<Intent>, draft: Partial<Intent> = {}): Partial<Intent> {
  const result: Partial<Intent> = { ...draft }
  for (const key of Object.keys(partial) as (keyof Intent)[]) {
    const value = partial[key]
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result
}
