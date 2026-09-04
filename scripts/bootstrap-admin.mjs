/**
 * Promotes an existing Firebase Auth user to the protected Super Admin role.
 * Firestore `users/{uid}` profile.
 *
 * Usage (from the repo root):
 *   node scripts/bootstrap-admin.mjs <email>
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS to point at a service-account key
 * with access to the project (or `firebase login` + default credentials).
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/bootstrap-admin.mjs <email>')
  process.exit(1)
}

initializeApp({ credential: applicationDefault() })

try {
  const user = await getAuth().getUserByEmail(email)
  const now = new Date().toISOString()
  await getFirestore().collection('users').doc(user.uid).set(
    {
      email: user.email,
      displayName: user.displayName ?? user.email,
      role: 'super_admin',
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  )
  console.log(`Promoted ${email} (uid ${user.uid}) to Super Admin.`)
} catch (error) {
  console.error(`Failed to promote ${email}:`, error)
  process.exit(1)
}
