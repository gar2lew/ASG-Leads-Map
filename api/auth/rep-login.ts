import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function hashPin(pin: string, salt: Buffer): Buffer {
  return scryptSync(pin, salt, 32)
}

function validPin(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}$/.test(value)
}

/** Rep sign-in by display name and four-digit PIN. Returns a Firebase custom token. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : ''
  const pin = req.body?.pin
  if (!displayName || !validPin(pin)) {
    res.status(400).json({ error: 'Select your name and enter a valid four-digit PIN.' })
    return
  }

  try {
    const { getAdminAuth, getAdminDb } = await import('../_lib/admin.js')
    const db = await getAdminDb()
    const snapshot = await db.collection('users').where('displayName', '==', displayName).where('role', '==', 'rep').limit(2).get()
    if (snapshot.size !== 1) {
      res.status(401).json({ error: 'That name or PIN is not recognised.' })
      return
    }
    const document = snapshot.docs[0]
    const profile = document.data()
    if (profile.active === false || typeof profile.pinHash !== 'string' || typeof profile.pinSalt !== 'string') {
      res.status(403).json({ error: 'This rep account is not ready for PIN sign-in.' })
      return
    }
    const salt = Buffer.from(profile.pinSalt, 'base64')
    const expected = Buffer.from(profile.pinHash, 'base64')
    const matches = expected.length === 32 && timingSafeEqual(hashPin(pin, salt), expected)
    if (!matches) {
      res.status(401).json({ error: 'That name or PIN is not recognised.' })
      return
    }
    const token = await (await getAdminAuth()).createCustomToken(document.id)
    res.status(200).json({ token, requiresPinSetup: profile.pinSetupRequired !== false })
  } catch (error) {
    console.error('Rep PIN sign-in failed:', error)
    res.status(500).json({ error: 'Unable to sign in right now.' })
  }
}

export function createPinCredentials(pin: string): { pinHash: string; pinSalt: string } {
  const salt = randomBytes(16)
  return { pinHash: hashPin(pin, salt).toString('base64'), pinSalt: salt.toString('base64') }
}
