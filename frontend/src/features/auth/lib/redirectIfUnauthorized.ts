import {ApiError} from '@/shared/api/apiError'
import {routes} from '@/app/routes'

export function redirectIfUnauthorized(error: unknown): void {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    localStorage.removeItem('csrf_token')
    window.location.href = routes.login
  }
}
