import { timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function validPin(value: unknown): value is string {
  return typeof value === 'string' && /^\d{6}$/.test(value)
}

function matchesConfiguredPin(pin: string): boolean {
  const configured = process.env.ADMIN_LOGIN_PIN
  if (!configured || !/^\d{6}$/.test(configured)) return false
  return timingSafeEqual(Buffer.from(pin), Buffer.from(configured))
}

/** Administrator sign-in by the single server-configured six-digit PIN. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const pin = req.body?.pin
  if (!validPin(pin)) {
    res.status(400).json({ error: 'Enter a valid six-digit administrator PIN.' })
    return
  }
  if (!matchesConfiguredPin(pin)) {
    res.status(401).json({ error: 'Invalid administrator PIN.' })
    return
  }

  try {
    const { getAdminAuth, getAdminDb } = await import('../_lib/admin.js')
    const snapshot = await (await getAdminDb()).collection('users').where('role', '==', 'super_admin').limit(2).get()
    if (snapshot.size !== 1) {
      res.status(403).json({ error: 'The administrator account is not configured.' })
      return
    }

    const document = snapshot.docs[0]
    const profile = document.data()
    if (profile.active === false) {
      res.status(403).json({ error: 'This administrator account has been disabled.' })
      return
    }

    const token = await (await getAdminAuth()).createCustomToken(document.id)
    res.status(200).json({ token, requiresPinSetup: false })
  } catch (error) {
    console.error('Administrator PIN sign-in failed:', error)
    res.status(500).json({ error: 'Unable to sign in right now.' })
  }
}
