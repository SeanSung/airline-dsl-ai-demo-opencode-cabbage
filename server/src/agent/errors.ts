import type { ValidationError } from '../airline/index.js'

export class MissingIntentParamsError extends Error {
  readonly missing: string[]

  constructor(missing: string[]) {
    super(`缺少必填意图参数: ${missing.join(', ')}`)
    this.name = 'MissingIntentParamsError'
    this.missing = missing
  }
}

export class AirlineValidationError extends Error {
  readonly errors: ValidationError[]

  constructor(errors: ValidationError[]) {
    super(`航线数据校验失败: ${errors.map((error) => `${error.path}: ${error.message}`).join('; ')}`)
    this.name = 'AirlineValidationError'
    this.errors = errors
  }
}
