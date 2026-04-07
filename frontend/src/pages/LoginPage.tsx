import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {login} from '../lib/api'

export function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    try {
      await login(password)
      navigate('/')
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card card" onSubmit={handleSubmit}>
        <h1 className="login-title">Lexora</h1>
        <input
          className="login-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="login-error">Wrong password</p>}
        <button className="login-btn" type="submit" disabled={loading || !password}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
