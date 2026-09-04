/**
 * Firebase configuration, driven entirely by Vite env vars.
 *
 * Names follow the Firebase web SDK convention and match `.env.example`.
 * All values are optional at build time so the app can run without a
 * Firebase project configured (e.g. local dev with the dev auth harness,
 * or unit tests).
 */

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

function defined(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0
}

export function getFirebaseConfig(): FirebaseConfig | null {
  const env = import.meta.env
  const config: FirebaseConfig = {
    apiKey: env['VITE_FIREBASE_API_KEY'] ?? '',
    authDomain: env['VITE_FIREBASE_AUTH_DOMAIN'] ?? '',
    projectId: env['VITE_FIREBASE_PROJECT_ID'] ?? '',
    storageBucket: env['VITE_FIREBASE_STORAGE_BUCKET'] ?? '',
    messagingSenderId: env['VITE_FIREBASE_MESSAGING_SENDER_ID'] ?? '',
    appId: env['VITE_FIREBASE_APP_ID'] ?? '',
  }

  const values = Object.values(config)
  if (!values.every(defined)) {
    return null
  }
  return config
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfig() !== null
}