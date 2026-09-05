import { randomBytes } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface CreateUserBody {
  email?: unknown
  displayName?: unknown
  role?: unknown
  teamId?: unknown
  officeId?: unknown
}

function generateTemporaryPassword(): string {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(18)
  let password = ''
  for (let i = 0; i < bytes.length && password.length < 12; i++) {
    password += characters[bytes[i] % characters.length]
  }
  return password
}

/**
 * POST /api/admin/users
 * Creates a Firebase Auth user with a temporary password and seeds their
 * Firestore `users/{uid}` profile. Only active admins may call this.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Dynamically import admin to avoid ESM module loading issues at module load time
  const { verifySuperAdminCaller, getAdminAuth, getAdminDb, isAdminRole } = await import('../_lib/admin.js')

  const callerUid = await verifySuperAdminCaller(req)
  if (!callerUid) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const body = (req.body ?? {}) as CreateUserBody
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  const role = typeof body.role === 'string' ? body.role : ''
  const teamId = typeof body.teamId === 'string' && body.teamId.trim() ? body.teamId.trim() : undefined
  const officeId = body.officeId === 'perth' || body.officeId === 'brisbane' ? body.officeId : ''

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Enter a valid email address.' })
    return
  }
  if (!displayName) {
    res.status(400).json({ error: 'Enter a display name.' })
    return
  }
  if (!isAdminRole(role)) {
    res.status(400).json({ error: 'Select a valid role.' })
    return
  }
  if (!officeId) {
    res.status(400).json({ error: 'Select a valid office.' })
    return
  }

  const auth = await getAdminAuth()
  const db = await getAdminDb()
  try {
    const existing = await auth.getUserByEmail(email)
    if (existing) {
      res.status(409).json({ error: 'A user with this email already exists.' })
      return
    }
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''
    if (code !== 'auth/user-not-found') {
      res.status(500).json({ error: 'Unable to check existing users.' })
      return
    }
  }

  const temporaryPassword = generateTemporaryPassword()
  try {
    const created = await auth.createUser({
      email,
      emailVerified: false,
      password: temporaryPassword,
      displayName,
    })

    const now = new Date().toISOString()
    const profile: Record<string, unknown> = {
      email,
      displayName,
    role,
    officeId,
      active: true,
      createdAt: now,
      updatedAt: now,
    }
    if (teamId) profile.teamId = teamId

    await db.collection('users').doc(created.uid).set(profile)

    res.status(201).json({
      user: { uid: created.uid, email, displayName, role, active: true, officeId, teamId },
      temporaryPassword,
    })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error &&
        (error as { code: unknown }).code === 'auth/email-already-exists') {
      res.status(409).json({ error: 'A user with this email already exists.' })
      return
    }
    console.error('Create user failed:', error)
    res.status(500).json({ error: 'Failed to create user.' })
  }
}
