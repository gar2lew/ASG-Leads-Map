import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import {
  useCurrentUser,
  getUserAdminService,
  getAuthService,
} from '../auth'
import {
  canManageUsers,
  roleLabel,
  Role,
  type Role as RoleType,
} from '../domain/roles'
import type { CreatedUserResult, UserProfileRecord } from '../auth/types'
import type { UpdateUserInput } from '../auth/types'
import { UserEditor } from '../components/UserEditor'
import './AdminUsersPage.css'

const EMPTY_ROLE: RoleType = Role.Rep
const MANAGED_ROLES: RoleType[] = [Role.Manager, Role.Rep]

export function AdminUsersPage() {
  const currentUser = useCurrentUser()
  const [users, setUsers] = useState<UserProfileRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createName, setCreateName] = useState('')
  const [createRole, setCreateRole] = useState<RoleType>(EMPTY_ROLE)
  const [createOffice, setCreateOffice] = useState<'perth' | 'brisbane'>('perth')
  const [createTeam, setCreateTeam] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createdResult, setCreatedResult] = useState<CreatedUserResult | null>(null)

  const [editingUser, setEditingUser] = useState<UserProfileRecord | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleType | ''>('')

  const hasAccess = canManageUsers(currentUser.role)

  useEffect(() => {
    void loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!hasAccess) {
    return <Navigate to="/map" replace />
  }

  async function loadUsers() {
    setIsLoading(true)
    setLoadError(null)
    try {
      const list = await getUserAdminService().listUsers()
      setUsers(list)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load users.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError(null)
    setCreatedResult(null)
    setIsCreating(true)
    try {
      const result = await getUserAdminService().createUser({
        email: createEmail,
        displayName: createName,
        role: createRole,
        officeId: createOffice,
        ...(createTeam.trim() ? { teamId: createTeam.trim() } : {}),
      })
      setCreatedResult(result)
      setUsers((prev) => [...prev, result.user].sort((a, b) => a.displayName.localeCompare(b.displayName)))
      setCreateEmail('')
      setCreateName('')
      setCreateRole(EMPTY_ROLE)
      setCreateOffice('perth')
      setCreateTeam('')
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create user.')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleUserSave(input: UpdateUserInput) {
    if (!editingUser) return
    setRowBusy(editingUser.uid)
    setRowError(null)
    try {
      const updated = await getUserAdminService().updateUser(editingUser.uid, input)
      setUsers((prev) => prev.map((u) => (u.uid === editingUser.uid ? updated : u)))
      setEditingUser(null)
    } catch (error) {
      setRowError(error instanceof Error ? error.message : 'Failed to update user.')
    } finally {
      setRowBusy(null)
    }
  }

  async function handlePasswordReset(): Promise<string> {
    if (!editingUser) throw new Error('No user selected.')
    setRowBusy(editingUser.uid)
    setRowError(null)
    try {
      const result = await getUserAdminService().resetUserPassword(editingUser.uid)
      return result.temporaryPassword
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset password.'
      setRowError(message)
      throw error
    } finally {
      setRowBusy(null)
    }
  }

  async function handleSignOut() {
    await getAuthService().signOut()
  }

  // Filter users
  const filteredUsers = users.filter((user) => {
    const query = searchQuery.trim().toLowerCase()
    if (query && !user.displayName.toLowerCase().includes(query) && !user.email.toLowerCase().includes(query)) return false
    if (roleFilter && user.role !== roleFilter) return false
    return true
  })

  return (
    <section className="admin-users" aria-label="User management">
      <header className="admin-users__header">
        <div>
          <span className="admin-users__eyebrow">Administration</span>
          <h1 className="admin-users__title">User Management</h1>
          <p className="admin-users__summary">{users.length} users</p>
        </div>
        <div className="admin-users__actions">
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => {
              setShowCreate(true)
              setCreatedResult(null)
              setCreateError(null)
            }}
          >
            <svg className="icon btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create user
          </button>
          <button className="btn btn--ghost" type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="admin-users__search-bar">
        <input
          type="search"
          className="form-input"
          placeholder="Search users by name or email…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="form-input"
          style={{ maxWidth: 160 }}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleType | '')}
        >
          <option value="">All roles</option>
          <option value={Role.Manager}>Manager</option>
          <option value={Role.Rep}>Rep</option>
        </select>
      </div>

      {rowError && (
        <p className="admin-users__error" role="alert">
          {rowError}
        </p>
      )}

      {isLoading && <p className="admin-users__loading">Loading users…</p>}

      {loadError && (
        <p className="admin-users__error" role="alert">
          {loadError}
        </p>
      )}

      {!isLoading && !loadError && users.length === 0 && (
        <p className="admin-users__empty">No users yet.</p>
      )}

      {users.length > 0 && (
        <div className="admin-users__table-container">
          <table className="admin-users__table">
            <caption className="visually-hidden">User accounts</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Office</th>
                <th scope="col">Team</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.uid} className={`admin-users__row ${user.active ? '' : 'admin-users__row--disabled'}`}>
                  <td data-label="Name">
                    <span className="admin-users__name">{user.displayName}</span>
                  </td>
                  <td data-label="Email">{user.email}</td>
                  <td data-label="Role"><span className="admin-users__role">{roleLabel(user.role)}</span></td>
                  <td data-label="Office">{user.officeId === 'brisbane' ? 'Brisbane' : user.officeId === 'perth' ? 'Perth' : 'Unassigned'}</td>
                  <td data-label="Team">{user.teamId ?? '—'}</td>
                  <td data-label="Status">
                    <span className={`admin-users__status ${user.active ? 'admin-users__status--active' : 'admin-users__status--disabled'}`}>
                      {user.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td data-label="Actions" className="admin-users__row-actions-cell">
                    <button
                      className="btn btn--ghost btn--sm"
                      type="button"
                      disabled={rowBusy === user.uid}
                      onClick={() => {
                        setRowError(null)
                        setEditingUser(user)
                      }}
                    >
                      Edit user
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <div className="admin-users__modal-overlay" role="presentation" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="admin-users__modal" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
            <header className="admin-users__modal-header">
              <div>
                <span className="admin-users__modal-eyebrow">User management</span>
                <h2 id="create-user-title" className="admin-users__modal-title">Create user</h2>
              </div>
              <button
                type="button"
                className="admin-users__modal-close"
                aria-label="Close create user dialog"
                onClick={() => setShowCreate(false)}
              >
                ×
              </button>
            </header>
            <form className="admin-users__modal-form" onSubmit={handleCreateSubmit} noValidate>
              <div className="admin-users__modal-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="user-office">Office</label>
                  <select id="user-office" className="form-input" value={createOffice} onChange={(event) => setCreateOffice(event.target.value as 'perth' | 'brisbane')}>
                    <option value="perth">Perth</option>
                    <option value="brisbane">Brisbane</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="user-email">Email*</label>
                  <input
                    id="user-email"
                    className="form-input"
                    type="email"
                    name="email"
                    value={createEmail}
                    onChange={(event) => setCreateEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="user-name">Display name*</label>
                  <input
                    id="user-name"
                    className="form-input"
                    type="text"
                    name="displayName"
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="user-role">Role</label>
                  <select
                    id="user-role"
                    className="form-input"
                    name="role"
                    value={createRole}
                    onChange={(event) => setCreateRole(event.target.value as RoleType)}
                  >
                    {MANAGED_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {roleLabel(role)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="user-team">Team (optional)</label>
                  <input
                    id="user-team"
                    className="form-input"
                    type="text"
                    name="teamId"
                    value={createTeam}
                    onChange={(event) => setCreateTeam(event.target.value)}
                  />
                </div>
              </div>
              {createError && (
                <p className="admin-users__error" role="alert">
                  {createError}
                </p>
              )}
              {createdResult && (
                <div className="admin-users__created" role="status">
                  <p>
                    <strong>User created.</strong> Share this one-time password with{' '}
                    <code>{createdResult.user.email}</code>:
                  </p>
                  <code className="admin-users__password">{createdResult.temporaryPassword}</code>
                  <p className="admin-users__created-note">
                    They can change it after their first sign-in.
                  </p>
                </div>
              )}
              <footer className="admin-users__modal-footer">
                <button className="btn btn--ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn btn--primary" type="submit" disabled={isCreating}>
                  {isCreating ? 'Creating…' : 'Create user'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <UserEditor
          user={editingUser}
          isProtected={editingUser.role === Role.SuperAdmin}
          busy={rowBusy === editingUser.uid}
          error={rowError}
          onClose={() => setEditingUser(null)}
          onSave={handleUserSave}
          onResetPassword={handlePasswordReset}
        />
      )}
    </section>
  )
}
