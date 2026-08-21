export class MissingIntentParamsError extends Error {
  readonly missing: string[]

  constructor(missing: string[]) {
    super(`缺少必填意图参数: ${missing.join(', ')}`)
    this.name = 'MissingIntentParamsError'
    this.missing = missing
  }
}
