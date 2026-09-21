import { timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createPinCredentials, isSixDigitPin } from '../_lib/pinCredentials.js'

function matchesSetupCode(value: unknown): value is string {
  const configured = process.env.ADMIN_SETUP_CODE
  if (typeof value !== 'string' || !configured || value.length !== configured.length) return false
  return timingSafeEqual(Buffer.from(value), Buffer.from(configured))
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const setupCode = req.body?.setupCode
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = req.body?.password
  const pin = req.body?.pin
  if (!matchesSetupCode(setupCode) || !validEmail(email) || typeof password !== 'string' || password.length < 10 || !isSixDigitPin(pin)) {
    return res.status(400).json({ error: 'Enter valid setup details.' })
  }

  let uid: string | null = null
  try {
    const { getAdminAuth, getAdminDb } = await import('../_lib/admin.js')
    const auth = await getAdminAuth()
    const db = await getAdminDb()
    const bootstrapRef = db.collection('_system').doc('adminBootstrap')
    const admins = await db.collection('users').where('role', '==', 'super_admin').limit(2).get()
    if (!admins.empty) return res.status(409).json({ error: 'Administrator setup is already complete.' })
    const existing = await bootstrapRef.get()
    if (existing.exists) return res.status(409).json({ error: 'Administrator setup is already complete.' })

    const account = await auth.createUser({ email, password, emailVerified: true, displayName: 'Administrator' })
    const createdUid = account.uid
    uid = createdUid
    const credentials = createPinCredentials(pin)
    const now = new Date().toISOString()
    await db.runTransaction(async (transaction) => {
      const marker = await transaction.get(bootstrapRef)
      const currentAdmins = await transaction.get(db.collection('users').where('role', '==', 'super_admin').limit(2))
      if (marker.exists || !currentAdmins.empty) throw new Error('ADMIN_BOOTSTRAP_COMPLETE')
      transaction.set(bootstrapRef, { completedAt: now, uid: createdUid })
      transaction.set(db.collection('users').doc(createdUid), {
        uid: createdUid,
        email,
        displayName: 'Administrator',
        role: 'super_admin',
        active: true,
        ...credentials,
        createdAt: now,
        updatedAt: now,
      })
    })
    const token = await auth.createCustomToken(createdUid)
    return res.status(201).json({ token })
  } catch (error) {
    if (uid) {
      try {
        const { getAdminAuth } = await import('../_lib/admin.js')
        await (await getAdminAuth()).deleteUser(uid)
      } catch (cleanupError) {
        console.error('Admin bootstrap cleanup failed:', cleanupError)
      }
    }
    if (error instanceof Error && error.message === 'ADMIN_BOOTSTRAP_COMPLETE') return res.status(409).json({ error: 'Administrator setup is already complete.' })
    console.error('Admin bootstrap failed:', error)
    return res.status(500).json({ error: 'Unable to complete administrator setup right now.' })
  }
}
