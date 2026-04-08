import {request} from '../../shared/http'

export const purgeTrash = () => request<void>('/api/trash/purge', {method: 'DELETE'})
