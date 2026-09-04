import type { VercelRequest, VercelResponse } from '@vercel/node'

interface UpdateUserBody {
  email?: unknown
  displayName?: unknown
  role?: unknown
  teamId?: unknown
  active?: unknown
}

/**
 * PATCH /api/admin/users/:uid
 * Updates a user's Firestore profile (displayName/role/teamId/active) and
 * keeps the Firebase Auth record in sync where relevant. Only active admins
 * may call this.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Dynamically import admin to avoid ESM module loading issues at module load time
  const { verifySuperAdminCaller, getAdminAuth, getAdminDb, isAdminRole } = await import('../../_lib/admin.js')

  const callerUid = await verifySuperAdminCaller(req)
  if (!callerUid) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const uid = typeof req.query.uid === 'string' ? req.query.uid : ''
  if (!uid) {
    res.status(400).json({ error: 'Missing user id.' })
    return
  }

  const body = (req.body ?? {}) as UpdateUserBody
  const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : undefined
  const displayName = body.displayName !== undefined ? String(body.displayName).trim() : undefined
  const role = body.role !== undefined ? String(body.role) : undefined
  const teamId = body.teamId === '' || body.teamId === undefined ? undefined : String(body.teamId).trim()
  const active = body.active !== undefined ? Boolean(body.active) : undefined

  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Enter a valid email address.' })
    return
  }

  if (displayName !== undefined && !displayName) {
    res.status(400).json({ error: 'Enter a display name.' })
    return
  }

  const auth = await getAdminAuth()
  const db = await getAdminDb()
  const userRef = db.collection('users').doc(uid)
  const existing = await userRef.get()
  if (!existing.exists) {
    res.status(404).json({ error: 'User not found.' })
    return
  }

  const current = existing.data() as Record<string, unknown> | undefined
  const currentRole = typeof current?.role === 'string' ? current.role : 'rep'
  if (currentRole === 'super_admin') {
    if (active === false) {
      res.status(400).json({ error: 'The Super Admin account cannot be deactivated.' })
      return
    }
    if (role !== undefined && role !== 'super_admin') {
      res.status(400).json({ error: 'The Super Admin role cannot be changed.' })
      return
    }
  } else if (role !== undefined && !isAdminRole(role)) {
    res.status(400).json({ error: 'Role must be Manager or Rep.' })
    return
  }

  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (email !== undefined) update.email = email
  if (displayName !== undefined) update.displayName = displayName
  if (role !== undefined) update.role = role
  if (body.teamId !== undefined) update.teamId = teamId ?? null
  if (active !== undefined) update.active = active

  try {
    if (displayName !== undefined || email !== undefined || active !== undefined) {
      await auth.updateUser(uid, {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(active !== undefined ? { disabled: !active } : {}),
      })
    }
    await userRef.update(update)

    const profile = {
      uid,
      email: (update.email ?? current?.email ?? '') as string,
      displayName: (update.displayName ?? current?.displayName ?? '') as string,
      role: (update.role ?? current?.role ?? 'rep') as string,
      active: (update.active ?? current?.active ?? true) as boolean,
    }
    const result: Record<string, unknown> = { ...profile }
    if (typeof update.teamId === 'string') {
      result.teamId = update.teamId
    } else if (body.teamId === undefined && typeof current?.teamId === 'string') {
      result.teamId = current.teamId
    }

    res.status(200).json({ user: result })
  } catch (error) {
    console.error('Update user failed:', error)
    res.status(500).json({ error: 'Failed to update user.' })
  }
}
