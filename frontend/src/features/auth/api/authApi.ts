import {request} from '@/shared/api/http'
import {ApiError} from '@/shared/api/apiError'

export async function login(password: string): Promise<void> {
  const data = await request<{ok: boolean; csrf_token: string}>('/auth/login', {method: 'POST', body: JSON.stringify({password})})
  localStorage.setItem('csrf_token', data.csrf_token)
}

export async function bootstrapSession(): Promise<boolean> {
  const hadToken = Boolean(localStorage.getItem('csrf_token'))

  try {
    const data = await request<{authenticated: boolean; csrf_token: string}>('/auth/session')
    localStorage.setItem('csrf_token', data.csrf_token)
    return data.authenticated
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      localStorage.removeItem('csrf_token')
      return false
    }

    return hadToken
  }
}
