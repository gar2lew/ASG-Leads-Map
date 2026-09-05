import type { Pin, PinFilters } from './pin'
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { getFirebaseApp } from '../firebase/app'
import { isFirebaseConfigured } from '../firebase/config'
import { getFirestoreDb } from '../firebase/firestore'

const DB_NAME = 'asg-leads-map'
const DB_VERSION = 1
const STORE_NAME = 'pins'

function remoteStorageEnabled(): boolean {
  return isFirebaseConfigured() && (!import.meta.env.DEV || import.meta.env['VITE_USE_DEV_AUTH'] === 'false')
}

async function remoteContext(): Promise<{ uid: string; officeId: 'perth' | 'brisbane' } | null> {
  if (!remoteStorageEnabled()) return null
  const { getAuth } = await import('firebase/auth')
  const user = getAuth(getFirebaseApp()).currentUser
  if (!user) return null
  const profile = await getDoc(doc(getFirestoreDb(), 'users', user.uid))
  const officeId = profile.data()?.['officeId']
  if (officeId !== 'perth' && officeId !== 'brisbane') return null
  return { uid: user.uid, officeId }
}

async function saveRemotePin(pin: Pin): Promise<boolean> {
  const context = await remoteContext()
  if (!context || pin.officeId !== context.officeId) return false
  await setDoc(doc(getFirestoreDb(), 'pins', pin.id), {
    ...pin,
    officeId: context.officeId,
  })
  return true
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('by-outcome', 'outcome', { unique: false })
        store.createIndex('by-createdAt', 'createdAt', { unique: false })
        store.createIndex('by-synced', 'synced', { unique: false })
        store.createIndex('by-location', ['latitude', 'longitude'], { unique: false })
      }
    }
  })
}

function withTransaction<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode)
      const store = transaction.objectStore(STORE_NAME)
      const request = callback(store)

      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error)
      request.onerror = () => reject(request.error)
    })
  })
}

export async function savePin(pin: Pin): Promise<void> {
  await withTransaction('readwrite', (store) => store.put(pin))
  try {
    if (await saveRemotePin(pin)) {
      await markLocalPinSynced(pin.id)
    }
  } catch {
    // IndexedDB remains the offline queue when Firestore is unavailable.
  }
}

async function markLocalPinSynced(id: string): Promise<void> {
  const local = await getPin(id)
  if (!local) return
  local.synced = true
  local.syncAttempts = 0
  await withTransaction('readwrite', (store) => store.put(local))
}

export async function savePins(pins: Pin[]): Promise<void> {
  await withTransaction('readwrite', (store) => {
    pins.forEach((pin) => store.put(pin))
    return store.put(pins[0])
  })
}

export async function getPin(id: string): Promise<Pin | null> {
  return withTransaction('readonly', (store) => store.get(id))
}

export async function getAllPins(): Promise<Pin[]> {
  const localPins = await withTransaction('readonly', (store) => store.getAll())
  try {
    const context = await remoteContext()
    if (!context) return localPins
    const snapshot = await getDocs(query(collection(getFirestoreDb(), 'pins'), where('officeId', '==', context.officeId)))
    const remotePins = snapshot.docs.map((item) => item.data() as Pin)
    const merged = new Map(localPins.map((pin) => [pin.id, pin]))
    remotePins.forEach((pin) => merged.set(pin.id, { ...pin, synced: true, syncAttempts: 0 }))
    const result = [...merged.values()]
    await savePinsLocal(result)
    return result
  } catch {
    return localPins
  }
}

async function savePinsLocal(pins: Pin[]): Promise<void> {
  await Promise.all(pins.map((pin) => withTransaction('readwrite', (store) => store.put(pin))))
}

export async function getPinsByOutcome(outcome: Pin['outcome']): Promise<Pin[]> {
  return withTransaction('readonly', (store) => {
    const index = store.index('by-outcome')
    return index.getAll(outcome)
  })
}

export async function getUnsyncedPins(): Promise<Pin[]> {
  return withTransaction('readonly', (store) => {
    const request = store.getAll()
    return request
  })
}

export async function syncPendingPins(): Promise<{ synced: number; failed: number }> {
  if (typeof indexedDB === 'undefined') return { synced: 0, failed: 0 }
  const pending = (await getUnsyncedPins()).filter((pin) => !pin.synced)
  let synced = 0
  let failed = 0
  for (const pin of pending) {
    try {
      if (await saveRemotePin(pin)) {
        await markLocalPinSynced(pin.id)
        synced += 1
      }
    } catch {
      failed += 1
      await incrementSyncAttempts(pin.id)
    }
  }
  return { synced, failed }
}

export async function deletePin(id: string): Promise<void> {
  await withTransaction('readwrite', (store) => store.delete(id))
}

export async function clearAllPins(): Promise<void> {
  await withTransaction('readwrite', (store) => store.clear())
}

export async function getPinsFiltered(filters: PinFilters): Promise<Pin[]> {
  const allPins = await getAllPins()

  return allPins.filter((pin) => {
    if (filters.outcome && pin.outcome !== filters.outcome) return false
    if (filters.repId && pin.createdBy !== filters.repId) return false
    if (filters.dateFrom && pin.createdAt < filters.dateFrom) return false
    if (filters.dateTo && pin.createdAt > filters.dateTo) return false
    if (filters.bounds) {
      if (pin.latitude < filters.bounds.south || pin.latitude > filters.bounds.north) return false
      if (pin.longitude < filters.bounds.west || pin.longitude > filters.bounds.east) return false
    }
    return true
  })
}

export async function markPinSynced(id: string): Promise<void> {
  const pin = await getPin(id)
  if (pin) {
    pin.synced = true
    pin.syncAttempts = 0
    await savePin(pin)
  }
}

export async function incrementSyncAttempts(id: string): Promise<void> {
  const pin = await getPin(id)
  if (pin) {
    pin.syncAttempts += 1
    await savePin(pin)
  }
}

export async function getPinCount(): Promise<number> {
  return withTransaction('readonly', (store) => store.count())
}

export async function getPinCountByOutcome(): Promise<Record<string, number>> {
  const pins = await getAllPins()
  const counts: Record<string, number> = {}
  pins.forEach((pin) => {
    counts[pin.outcome] = (counts[pin.outcome] || 0) + 1
  })
  return counts
}
