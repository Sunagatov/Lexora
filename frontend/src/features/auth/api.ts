import {request} from '../../shared/http'

export async function login(password: string): Promise<void> {
  const data = await request<{ok: boolean; csrf_token: string}>('/auth/login', {method: 'POST', body: JSON.stringify({password})})
  localStorage.setItem('csrf_token', data.csrf_token)
}

export async function bootstrapSession(): Promise<boolean> {
  try {
    const data = await request<{authenticated: boolean; csrf_token: string}>('/auth/session')
    localStorage.setItem('csrf_token', data.csrf_token)
    return data.authenticated
  } catch {
    return false
  }
}
