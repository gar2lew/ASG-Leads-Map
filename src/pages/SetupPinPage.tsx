import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getAuthService, useCurrentUser } from '../auth'

export function SetupPinPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  if (user.role !== 'rep') return <Navigate to="/map" replace />
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null)
    if (!/^\d{4}$/.test(pin) || pin === '0000' || pin !== confirmation) { setError('Enter matching four-digit PINs. The new PIN cannot be 0000.'); return }
    setSaving(true)
    try {
      const token = await getAuthService().getAccessToken()
      const response = await fetch('/api/auth/rep-pin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` }, body: JSON.stringify({ pin }) })
      if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error ?? 'Unable to save PIN.') }
      navigate('/map', { replace: true })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save PIN.') } finally { setSaving(false) }
  }
  return <main className="login-page login-experience"><div className="login-page__card"><header className="login-page__header"><h1 className="login-page__title">Set your PIN</h1><p className="login-page__subtitle">Welcome, {user.name}</p></header><form className="login-page__form" onSubmit={submit}><label className="form-label" htmlFor="new-pin">New 4-digit PIN</label><input id="new-pin" className="form-input" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} required /><label className="form-label" htmlFor="confirm-pin">Confirm PIN</label><input id="confirm-pin" className="form-input" type="password" inputMode="numeric" maxLength={4} value={confirmation} onChange={(event) => setConfirmation(event.target.value.replace(/\D/g, '').slice(0, 4))} required />{error && <p className="login-page__error" role="alert">{error}</p>}<button className="btn btn--primary btn--block" disabled={saving}>{saving ? 'Saving…' : 'Save PIN'}</button></form></div></main>
}
