import {useNavigate} from 'react-router-dom'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {logout} from '../../lib/api'

export function AppHeader() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()

  const mutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear()
      navigate('/login')
    },
  })

  return (
    <header className="app-header">
      <button type="button" className="app-header-brand" onClick={() => navigate('/')}>
        Lexora
      </button>
      <button type="button" className="app-header-logout" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Signing out…' : 'Sign out'}
      </button>
    </header>
  )
}
