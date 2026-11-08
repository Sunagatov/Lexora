import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQueryClient} from '@tanstack/react-query'
import {routes} from '@/app/routes'
import {logout, logoutAll} from '@/features/auth/api/authApi'

export function useLogoutAction() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  async function signOut(allDevices: boolean) {
    if (logoutPending) return

    setLogoutPending(true)
    setLogoutError('')
    try {
      if (await (allDevices ? logoutAll() : logout()) === false) return
      queryClient.clear()
      navigate(routes.login, {replace: true})
    } catch (error) {
      setLogoutError(error instanceof Error
        ? `Could not sign out: ${error.message}`
        : 'Could not sign out. Please try again.')
    } finally {
      setLogoutPending(false)
    }
  }

  return {
    logoutPending,
    logoutError,
    handleLogout: () => signOut(false),
    handleLogoutAll: () => signOut(true),
  }
}
