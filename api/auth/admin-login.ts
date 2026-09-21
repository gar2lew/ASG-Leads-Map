import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isSixDigitPin, matchesPin } from '../_lib/pinCredentials.js'

/** Administrator sign-in by the single server-configured six-digit PIN. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const pin = req.body?.pin
  if (!isSixDigitPin(pin)) {
    res.status(400).json({ error: 'Enter a valid six-digit administrator PIN.' })
    return
  }
  try {
    const { getAdminAuth, getAdminDb } = await import('../_lib/admin.js')
    const snapshot = await (await getAdminDb()).collection('users').where('role', '==', 'super_admin').limit(2).get()
    const activeAdmins = snapshot.docs.filter((document) => document.data().active !== false)
    if (activeAdmins.length !== 1) {
      res.status(401).json({ error: 'Invalid administrator PIN.' })
      return
    }

    const document = activeAdmins[0]
    const profile = document.data()
    if (typeof profile.pinHash !== 'string' || typeof profile.pinSalt !== 'string' || !matchesPin(pin, { pinHash: profile.pinHash, pinSalt: profile.pinSalt })) {
      res.status(401).json({ error: 'Invalid administrator PIN.' })
      return
    }

    const token = await (await getAdminAuth()).createCustomToken(document.id)
    res.status(200).json({ token, requiresPinSetup: false })
  } catch (error) {
    console.error('Administrator PIN sign-in failed:', error)
    res.status(500).json({ error: 'Unable to sign in right now.' })
  }
}
