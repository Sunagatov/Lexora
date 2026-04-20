export {ApiError} from './apiError'

import {ApiError} from './apiError'

function normalizeBaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim()
  if (trimmed) return trimmed.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/+$/, '')
  return ''
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)

export function buildApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

export function buildRequestHeaders(headersInit?: HeadersInit, body?: BodyInit | null): Headers {
  const headers = new Headers(headersInit)
  if (body && !(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const csrfToken = localStorage.getItem('csrf_token')
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken)
  return headers
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = buildRequestHeaders(init.headers, init.body)

  const response = await fetch(buildApiUrl(path), {...init, headers, credentials: 'include'})

  if (response.status === 401) throw new ApiError(401, 'Not authenticated')

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, detail)
  }

  if (response.status === 204 || response.status === 205) return undefined as unknown as T

  return response.json() as Promise<T>
}
