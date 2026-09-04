import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirebaseConfig } from './config'

let app: FirebaseApp | null = null

export function getFirebaseApp(): FirebaseApp {
  if (app) return app
  const config = getFirebaseConfig()
  if (!config) {
    throw new Error(
      'Firebase is not configured. Set VITE_FIREBASE_* environment variables (see .env.example).',
    )
  }
  app = initializeApp(config)
  return app
}