import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  try {
    const db = await (await import('../_lib/admin.js')).getAdminDb()
    const snapshot = await db.collection('users').where('role', '==', 'rep').where('active', '==', true).orderBy('displayName').get()
    res.status(200).json({ reps: snapshot.docs.map((doc) => ({ displayName: doc.data().displayName })) })
  } catch (error) {
    console.error('Rep list failed:', error)
    res.status(500).json({ error: 'Unable to load rep list.' })
  }
}
