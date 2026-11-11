export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export function isUncertainWriteError(error: unknown): boolean {
  return error instanceof TypeError
    || error instanceof DOMException && error.name === 'TimeoutError'
    || error instanceof ApiError && (error.status === 408 || error.status >= 500)
}
