import {request} from '@/shared/api/http'

export const purgeTrash = () => request<void>('/api/trash/purge?force=true', {method: 'DELETE'})
