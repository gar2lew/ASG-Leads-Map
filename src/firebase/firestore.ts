import type { Firestore } from 'firebase/firestore'
import { getFirestore } from 'firebase/firestore'
import { getFirebaseApp } from './app'

let db: Firestore | null = null

export function getFirestoreDb(): Firestore {
  if (db) return db
  db = getFirestore(getFirebaseApp())
  return db
}