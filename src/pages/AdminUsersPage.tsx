import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import {
  useCurrentUser,
  getUserAdminService,
  getAuthService,
} from '../auth'
import {
  canManageUsers,
  ROLE_ORDER,
  roleLabel,
  Role,
  type Role as RoleType,
} from '../domain/roles'
import type { CreatedUserResult, UserProfileRecord } from '../auth/types'
import './AdminUsersPage.css'

const EMPTY_ROLE: RoleType = Role.Rep

export function AdminUsersPage() {
  const currentUser = useCurrentUser()
  const [users, setUsers] = useState<UserProfileRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createName, setCreateName] = useState('')
  const [createRole, setCreateRole] = useState<RoleType>(EMPTY_ROLE)
  const [createTeam, setCreateTeam] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createdResult, setCreatedResult] = useState<CreatedUserResult | null>(null)

  const [editNameUid, setEditNameUid] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState('')
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

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
        ...(createTeam.trim() ? { teamId: createTeam.trim() } : {}),
      })
      setCreatedResult(result)
      setUsers((prev) => [...prev, result.user].sort((a, b) => a.displayName.localeCompare(b.displayName)))
      setCreateEmail('')
      setCreateName('')
      setCreateRole(EMPTY_ROLE)
      setCreateTeam('')
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create user.')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleRoleChange(uid: string, role: RoleType) {
    setRowBusy(uid)
    setRowError(null)
    try {
      const updated = await getUserAdminService().updateUser(uid, { role })
      setUsers((prev) => prev.map((u) => (u.uid === uid ? updated : u)))
    } catch (error) {
      setRowError(error instanceof Error ? error.message : 'Failed to update role.')
    } finally {
      setRowBusy(null)
    }
  }

  async function handleToggleActive(record: UserProfileRecord) {
    setRowBusy(record.uid)
    setRowError(null)
    try {
      const updated = await getUserAdminService().updateUser(record.uid, {
        active: !record.active,
      })
      setUsers((prev) => prev.map((u) => (u.uid === record.uid ? updated : u)))
    } catch (error) {
      setRowError(error instanceof Error ? error.message : 'Failed to update user.')
    } finally {
      setRowBusy(null)
    }
  }

  async function handleNameSave(uid: string) {
    const trimmed = editNameValue.trim()
    if (!trimmed) {
      setEditNameUid(null)
      return
    }
    setRowBusy(uid)
    setRowError(null)
    try {
      const updated = await getUserAdminService().updateUser(uid, { displayName: trimmed })
      setUsers((prev) => prev.map((u) => (u.uid === uid ? updated : u)))
      setEditNameUid(null)
    } catch (error) {
      setRowError(error instanceof Error ? error.message : 'Failed to update name.')
    } finally {
      setRowBusy(null)
    }
  }

  async function handleSignOut() {
    await getAuthService().signOut()
  }

  return (
    <section className="admin-users" aria-label="User management">
      <div className="admin-users__header">
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
              setShowCreate((open) => !open)
              setCreatedResult(null)
              setCreateError(null)
            }}
          >
            {showCreate ? 'Cancel' : 'Add user'}
          </button>
          <button className="btn btn--ghost" type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>

      {showCreate && (
        <form className="admin-users__create" onSubmit={handleCreateSubmit} noValidate>
          <h2 className="admin-users__create-title">Create user</h2>
          <div className="admin-users__create-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="user-email">
                Email*
              </label>
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
              <label className="form-label" htmlFor="user-name">
                Display name*
              </label>
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
              <label className="form-label" htmlFor="user-role">
                Role
              </label>
              <select
                id="user-role"
                className="form-input"
                name="role"
                value={createRole}
                onChange={(event) => setCreateRole(event.target.value as RoleType)}
              >
                {ROLE_ORDER.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="user-team">
                Team (optional)
              </label>
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
          <button className="btn btn--primary" type="submit" disabled={isCreating}>
            {isCreating ? 'Creating…' : 'Create user'}
          </button>
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
        </form>
      )}

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
        <div className="admin-users__panel">
        <table className="admin-users__table">
          <caption className="visually-hidden">User accounts</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Team</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.uid === currentUser.uid
              return (
                <tr key={user.uid} className={`admin-users__row ${user.active ? '' : 'admin-users__row--disabled'}`}>
                  <td>
                    {editNameUid === user.uid ? (
                      <>
                        <input
                          className="form-input"
                          value={editNameValue}
                          aria-label={`Edit name for ${user.email}`}
                          onChange={(event) => setEditNameValue(event.target.value)}
                        />
                        <button
                          className="btn btn--ghost btn--sm"
                          type="button"
                          onClick={() => void handleNameSave(user.uid)}
                          disabled={rowBusy === user.uid}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          type="button"
                          onClick={() => setEditNameUid(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <span className="admin-users__name">{user.displayName}</span>
                    )}
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <select
                      className="form-input admin-users__role-select"
                      value={user.role}
                      aria-label={`Role for ${user.email}`}
                      disabled={isSelf || rowBusy === user.uid}
                      onChange={(event) => void handleRoleChange(user.uid, event.target.value as RoleType)}
                    >
                      {ROLE_ORDER.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{user.teamId ?? '—'}</td>
                  <td>
                    <span className={`admin-users__status ${user.active ? 'admin-users__status--active' : 'admin-users__status--disabled'}`}>
                      {user.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn--ghost btn--sm"
                      type="button"
                      disabled={isSelf || rowBusy === user.uid}
                      onClick={() => {
                        if (editNameUid === user.uid) {
                          setEditNameUid(null)
                        } else {
                          setEditNameUid(user.uid)
                          setEditNameValue(user.displayName)
                        }
                      }}
                    >
                      Edit name
                    </button>
                    {!isSelf && (
                      <button
                        className="btn btn--ghost btn--sm"
                        type="button"
                        disabled={rowBusy === user.uid}
                        onClick={() => void handleToggleActive(user)}
                      >
                        {user.active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}
    </section>
  )
}
