import {ApiError} from './apiError'
import {routes} from './routes'

export function redirectIfUnauthorized(error: unknown): void {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    localStorage.removeItem('csrf_token')
    window.location.href = routes.login
  }
}
