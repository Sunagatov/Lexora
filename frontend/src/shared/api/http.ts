export {ApiError} from './apiError'

import {ApiError} from './apiError'
import {CSRF_TOKEN_STORAGE_KEY} from '@/shared/auth/storage'
import {isIOSApp} from '@/shared/platform'

function normalizeBaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim()
  if (trimmed) return trimmed.replace(/\/+$/, '')
  if (isIOSApp) return 'https://lexora.zuf.uk'
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/+$/, '')
  return ''
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)
let contextHeaders: () => Record<string, string> = () => ({})
let responseMapper: (value: unknown) => unknown = value => value
export function setRequestContext(headers: typeof contextHeaders, mapper: typeof responseMapper) { contextHeaders = headers; responseMapper = mapper }

export function buildApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

export function buildRequestHeaders(headersInit?: HeadersInit, body?: BodyInit | null): Headers {
  const headers = new Headers(headersInit)
  for (const [name, value] of Object.entries(contextHeaders())) if (!headers.has(name)) headers.set(name, value)
  if (body && !(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const csrfToken = localStorage.getItem(CSRF_TOKEN_STORAGE_KEY)
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken)
  return headers
}

type RequestAdapter = (path: string, init: RequestInit, network: typeof networkRequest) => Promise<unknown>
let requestAdapter: RequestAdapter | undefined

// App composition installs optional transports; shared HTTP has no feature imports.
export function setRequestAdapter(adapter: RequestAdapter) { requestAdapter = adapter }

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return responseMapper(await (requestAdapter ? requestAdapter(path, init, networkRequest) : networkRequest(path, init))) as T
}

export async function networkRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = buildRequestHeaders(init.headers, init.body)

  let response: Response
  try {
    response = await fetch(buildApiUrl(path), {...init, headers, credentials: 'include'})
  } catch (error) {
    // Report native URL loading errors like browser fetch failures so existing
    // offline and save recovery can handle them.
    if (isIOSApp && typeof error === 'object' && error !== null && 'code' in error && error.code === 'NSURLErrorDomain') {
      throw Object.assign(new TypeError('Could not reach Lexora'), {cause: error})
    }
    throw error
  }

  if (response.status === 401) throw new ApiError(401, 'Not authenticated')

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    let detail: unknown
    try {
      const body = await response.json()
      detail = body?.detail
      if (typeof detail === 'string') message = detail
      else if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string') {
        message = detail.message
      } else if (detail) message = JSON.stringify(detail)
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, message, detail)
  }

  if (response.status === 204 || response.status === 205) return undefined as unknown as T

  return await response.json() as T
}
