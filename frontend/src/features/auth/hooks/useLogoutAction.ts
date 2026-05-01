import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQueryClient} from '@tanstack/react-query'
import {routes} from '@/app/routes'
import {logout} from '@/features/auth/api/authApi'

export function useLogoutAction() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [logoutPending, setLogoutPending] = useState(false)

  async function handleLogout() {
    if (logoutPending) return

    setLogoutPending(true)
    try {
      await logout()
      queryClient.clear()
      navigate(routes.login, {replace: true})
    } finally {
      setLogoutPending(false)
    }
  }

  return {
    logoutPending,
    handleLogout,
  }
}
