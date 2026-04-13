export {ApiError} from './apiError'

import {ApiError} from './apiError'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${API_BASE_URL}${path}`, {...init, headers, credentials: 'include'})

  if (response.status === 401) throw new ApiError(401, 'Not authenticated')

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch { /* ignore parse errors */ }
    throw new ApiError(response.status, detail)
  }

  if (response.status === 204 || response.status === 205) return undefined as unknown as T

  return response.json() as Promise<T>
}
