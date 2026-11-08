export function AccountSecurity({pending, onLogoutAll}: {
  pending: boolean
  onLogoutAll: () => Promise<void>
}) {
  return <div className="account-surface">
    <div className="account-row">
      <span>Sign-in sessions<small>Sign out on every browser, including this one.</small></span>
      <button className="account-button" disabled={pending} onClick={() => {
        if (window.confirm('Sign out of Lexora on all devices, including this one?')) void onLogoutAll()
      }}>{pending ? 'Signing out…' : 'Sign out all devices'}</button>
    </div>
  </div>
}
