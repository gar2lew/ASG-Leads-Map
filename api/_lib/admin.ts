import type { VercelRequest } from '@vercel/node'

export const ADMIN_ROLES = ['manager', 'rep'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value)
}

async function loadFirebaseAdmin() {
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/auth'),
    import('firebase-admin/firestore'),
  ])
  return { appModule, authModule, firestoreModule }
}

function buildCredential(firebaseApp: typeof import('firebase-admin/app')) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY

  if (projectId && clientEmail && privateKey) {
    // Normalize private key: Vercel stores newlines as \n literals
    privateKey = privateKey.replace(/\\n/g, '\n')
    return firebaseApp.cert({ projectId, clientEmail, privateKey })
  }

  // Fall back to Application Default Credentials (local gcloud, Vercel ADC, etc.)
  return firebaseApp.applicationDefault()
}

// Lazy initialization - avoids top-level ESM module loading issues on Vercel
let adminApp: Awaited<ReturnType<typeof import('firebase-admin/app').initializeApp>> | null = null

async function getAdminApp() {
  if (adminApp) return adminApp
  const { getApp, initializeApp } = await import('firebase-admin/app')
  try {
    return getApp()
  } catch {
    const { appModule } = await loadFirebaseAdmin()
    const credential = buildCredential(appModule)
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
    adminApp = initializeApp({ credential, ...(projectId ? { projectId } : {}) })
    return adminApp
  }
}

async function getAdminAuth() {
  const { getAuth } = await import('firebase-admin/auth')
  const app = await getAdminApp()
  return getAuth(app)
}

async function getAdminDb() {
  const { getFirestore } = await import('firebase-admin/firestore')
  const app = await getAdminApp()
  return getFirestore(app)
}

/**
 * Verifies the caller's Firebase ID token and confirms their profile is an
 * active admin. Returns the caller uid, or null when unauthorized.
 */
export async function verifySuperAdminCaller(req: VercelRequest): Promise<string | null> {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return null
  }
  const token = header.slice('Bearer '.length).trim()
  try {
    const auth = await getAdminAuth()
    const db = await getAdminDb()
    const decoded = await auth.verifyIdToken(token)
    const snapshot = await db.collection('users').doc(decoded.uid).get()
    const profile = snapshot.data()
    if (!snapshot.exists || !profile || profile.active === false) {
      return null
    }
    if (profile.role !== 'super_admin') {
      return null
    }
    return decoded.uid
  } catch {
    return null
  }
}

// Export lazy getters for use in API handlers
export { getAdminAuth, getAdminDb, isAdminRole }
