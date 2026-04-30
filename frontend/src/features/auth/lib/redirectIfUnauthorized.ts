import {ApiError} from '@/shared/api/apiError'
import {routes} from '@/app/routes'
import {CSRF_TOKEN_STORAGE_KEY} from '@/shared/auth/storage'

export function redirectIfUnauthorized(error: unknown): void {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    localStorage.removeItem(CSRF_TOKEN_STORAGE_KEY)
    window.location.href = routes.login
  }
}
