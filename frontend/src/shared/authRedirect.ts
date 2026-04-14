import {ApiError} from './apiError'
import {routes} from './routes'

export function redirectIfUnauthorized(error: unknown): void {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    window.location.href = routes.login
  }
}
