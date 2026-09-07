import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomInt, randomBytes, scryptSync } from 'node:crypto'

function generateTemporaryPassword(): string {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(18)
  let password = ''
  for (let index = 0; index < bytes.length && password.length < 12; index += 1) {
    password += characters[bytes[index] % characters.length]
  }
  return password
}

function generateTemporaryPin(): string { return String(randomInt(0, 10000)).padStart(4, '0') }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { verifySuperAdminCaller, getAdminAuth, getAdminDb } = await import('../../../_lib/admin.js')
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

  try {
    const db = await getAdminDb()
    const profile = (await db.collection('users').doc(uid).get()).data()
    if (profile?.role === 'rep') {
      const temporaryPassword = generateTemporaryPin()
      const salt = randomBytes(16)
      await db.collection('users').doc(uid).update({ pinHash: scryptSync(temporaryPassword, salt, 32).toString('base64'), pinSalt: salt.toString('base64'), pinSetupRequired: true, updatedAt: new Date().toISOString() })
      res.status(200).json({ temporaryPassword })
      return
    }
    const temporaryPassword = generateTemporaryPassword()
    await (await getAdminAuth()).updateUser(uid, { password: temporaryPassword })
    res.status(200).json({ temporaryPassword })
  } catch (error) {
    console.error('Password reset failed:', error)
    res.status(500).json({ error: 'Failed to reset password.' })
  }
}
