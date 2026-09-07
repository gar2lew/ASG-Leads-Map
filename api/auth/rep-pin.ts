import { randomBytes, scryptSync } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function credentials(pin: string) {
  const salt = randomBytes(16)
  return { pinHash: scryptSync(pin, salt, 32).toString('base64'), pinSalt: salt.toString('base64') }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  const pin = req.body?.pin
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin) || pin === '0000') { res.status(400).json({ error: 'Choose a new four-digit PIN other than 0000.' }); return }
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) { res.status(401).json({ error: 'Not signed in.' }); return }
  try {
    const { getAdminAuth, getAdminDb } = await import('../_lib/admin.js')
    const auth = await getAdminAuth()
    const decoded = await auth.verifyIdToken(header.slice(7))
    const db = await getAdminDb()
    const ref = db.collection('users').doc(decoded.uid)
    const snapshot = await ref.get()
    if (!snapshot.exists || snapshot.data()?.role !== 'rep' || snapshot.data()?.active === false) { res.status(403).json({ error: 'Rep account required.' }); return }
    await ref.update({ ...credentials(pin), pinSetupRequired: false, updatedAt: new Date().toISOString() })
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('PIN setup failed:', error)
    res.status(500).json({ error: 'Unable to save PIN.' })
  }
}
