import {request} from '../../shared/http'

export async function login(password: string): Promise<void> {
  const data = await request<{ok: boolean; csrf_token: string}>('/auth/login', {method: 'POST', body: JSON.stringify({password})})
  localStorage.setItem('csrf_token', data.csrf_token)
}

export async function logout(): Promise<void> {
  await request<{ok: boolean}>('/auth/logout', {method: 'POST'})
  localStorage.removeItem('csrf_token')
}
