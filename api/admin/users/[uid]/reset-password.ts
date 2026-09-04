import { randomBytes } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function generateTemporaryPassword(): string {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(18)
  let password = ''
  for (let index = 0; index < bytes.length && password.length < 12; index += 1) {
    password += characters[bytes[index] % characters.length]
  }
  return password
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { verifySuperAdminCaller, getAdminAuth } = await import('../../../_lib/admin.js')
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
    const temporaryPassword = generateTemporaryPassword()
    await (await getAdminAuth()).updateUser(uid, { password: temporaryPassword })
    res.status(200).json({ temporaryPassword })
  } catch (error) {
    console.error('Password reset failed:', error)
    res.status(500).json({ error: 'Failed to reset password.' })
  }
}
