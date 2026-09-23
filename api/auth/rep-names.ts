import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  try {
    const db = await (await import('../_lib/admin.js')).getAdminDb()
    const snapshot = await db.collection('users').where('role', '==', 'rep').get()
    const reps = snapshot.docs
      .map((doc) => doc.data())
      .filter((profile) => profile.active !== false)
      .map((profile) => ({ displayName: typeof profile.displayName === 'string' ? profile.displayName : '' }))
      .filter((rep) => rep.displayName)
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
    res.status(200).json({ reps })
  } catch (error) {
    console.error('Rep list failed:', error)
    res.status(500).json({ error: 'Unable to load rep list.' })
  }
}
