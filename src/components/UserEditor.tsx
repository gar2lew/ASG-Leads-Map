import { useState, type FormEvent } from 'react'
import { Role, roleLabel, type Role as RoleType } from '../domain/roles'
import type { UpdateUserInput, UserProfileRecord } from '../auth/types'
import './UserEditor.css'

interface UserEditorProps {
  user: UserProfileRecord
  isProtected: boolean
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (input: UpdateUserInput) => Promise<void>
  onResetPassword: () => Promise<string>
}

export function UserEditor({ user, isProtected, busy, error, onClose, onSave, onResetPassword }: UserEditorProps) {
  const [email, setEmail] = useState(user.email)
  const [displayName, setDisplayName] = useState(user.displayName)
  const [role, setRole] = useState<RoleType>(user.role)
  const [teamId, setTeamId] = useState(user.teamId ?? '')
  const [active, setActive] = useState(user.active)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    await onSave({
      email: email.trim().toLowerCase(),
      displayName: displayName.trim(),
      role,
      teamId: teamId.trim(),
      active,
    })
  }

  async function resetPassword() {
    try {
      setTemporaryPassword(await onResetPassword())
    } catch {
      setTemporaryPassword(null)
    }
  }

  return (
    <div className="user-editor__overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="user-editor surface--light" role="dialog" aria-modal="true" aria-labelledby="user-editor-title">
        <header className="user-editor__header">
          <div>
            <span className="user-editor__eyebrow">Account controls</span>
            <h2 id="user-editor-title">Edit user</h2>
            <p>{user.displayName}</p>
          </div>
          <button type="button" className="user-editor__close" aria-label="Close user editor" onClick={onClose}>×</button>
        </header>
        <form className="user-editor__form" onSubmit={submit}>
          <label>Display name<input className="form-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></label>
          <label>Email<input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Role<select className="form-input" value={role} onChange={(e) => setRole(e.target.value as RoleType)} disabled={isProtected}>
            {isProtected && <option value={Role.SuperAdmin}>{roleLabel(Role.SuperAdmin)}</option>}
            <option value={Role.Manager}>{roleLabel(Role.Manager)}</option>
            <option value={Role.Rep}>{roleLabel(Role.Rep)}</option>
          </select></label>
          <label>Team<input className="form-input" value={teamId} onChange={(e) => setTeamId(e.target.value)} placeholder="Optional" /></label>
          <label>Status<select className="form-input" value={active ? 'active' : 'disabled'} onChange={(e) => setActive(e.target.value === 'active')} disabled={isProtected}>
            <option value="active">Active</option><option value="disabled">Disabled</option>
          </select></label>
          {isProtected && <p className="user-editor__hint">The Super Admin role and active status are protected.</p>}
          <section className="user-editor__password" aria-label="Password reset">
            <div><strong>Temporary password</strong><p>Issue a new password for the user’s next sign-in.</p></div>
            <button className="btn btn--secondary" type="button" disabled={busy} onClick={() => void resetPassword()}>Issue temporary password</button>
            {temporaryPassword && <code className="user-editor__temporary-password">{temporaryPassword}</code>}
          </section>
          {error && <p className="admin-users__error" role="alert">{error}</p>}
          <footer className="user-editor__actions">
            <button className="btn btn--ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
