import {request} from '@/shared/api/http'
import {ApiError} from '@/shared/api/apiError'
import {CSRF_TOKEN_STORAGE_KEY} from '@/shared/auth/storage'

export async function login(password: string): Promise<void> {
  const data = await request<{ok: boolean; csrf_token: string}>('/auth/login', {method: 'POST', body: JSON.stringify({password})})
  localStorage.setItem(CSRF_TOKEN_STORAGE_KEY, data.csrf_token)
}

export async function logout(): Promise<boolean> {
  try { await request<{ok: boolean}>('/auth/logout', {method: 'POST'}) }
  catch (error) { if (error instanceof ApiError && error.status === 499) return false; throw error }
  localStorage.removeItem(CSRF_TOKEN_STORAGE_KEY)
  return true
}

export async function bootstrapSession(): Promise<boolean> {
  try {
    const data = await request<{authenticated: boolean; csrf_token: string}>('/auth/session')
    if (data.csrf_token) localStorage.setItem(CSRF_TOKEN_STORAGE_KEY, data.csrf_token)
    return data.authenticated
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status === 401 || error.status === 403)) {
      localStorage.removeItem(CSRF_TOKEN_STORAGE_KEY)
    }
    return false
  }
}
