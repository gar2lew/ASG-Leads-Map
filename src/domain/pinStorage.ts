import type { Pin, PinFilters } from './pin'

const DB_NAME = 'asg-leads-map'
const DB_VERSION = 1
const STORE_NAME = 'pins'

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
  return withTransaction('readonly', (store) => store.getAll())
}

export async function getPinsByOutcome(outcome: Pin['outcome']): Promise<Pin[]> {
  return withTransaction('readonly', (store) => {
    const index = store.index('by-outcome')
    return index.getAll(outcome)
  })
}

export async function getUnsyncedPins(): Promise<Pin[]> {
  return withTransaction('readonly', (store) => {
    const index = store.index('by-synced')
    return index.getAll(IDBKeyRange.only(false))
  })
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