import {request} from '../../shared/http'

export const login  = (password: string) => request<{ok: boolean}>('/auth/login', {method: 'POST', body: JSON.stringify({password})})
export const logout = ()                  => request<{ok: boolean}>('/auth/logout', {method: 'POST'})
