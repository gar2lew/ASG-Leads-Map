/* ===========================================
   TERRITORY REPOSITORY INTERFACE
   Abstracts persistence for local (IndexedDB) and future Firebase adapters
   =========================================== */

import type {
  Territory,
  CreateTerritoryInput,
  UpdateTerritoryInput,
  AssignTerritoryInput,
  TerritoryWithStats,
} from './territories'

export interface TerritoryRepository {
  /** List all territories */
  list(): Promise<Territory[]>
  
  /** List territories with optional stats */
  listWithStats(): Promise<TerritoryWithStats[]>
  
  /** Get a single territory by ID */
  get(id: string): Promise<Territory | null>
  
  /** Create a new territory */
  create(input: CreateTerritoryInput): Promise<Territory>
  
  /** Update an existing territory */
  update(id: string, input: UpdateTerritoryInput): Promise<Territory>
  
  /** Delete a territory */
  delete(id: string): Promise<void>
  
  /** Assign/reassign users to a territory */
  assign(id: string, input: AssignTerritoryInput): Promise<Territory>
  
  /** Get territories assigned to a specific user */
  getByUserId(userId: string): Promise<Territory[]>
  
  /** Get territories for an office */
  getByOfficeId(officeId: 'perth' | 'brisbane'): Promise<Territory[]>
  
  /** Subscribe to territory changes (for real-time updates) */
  subscribe(callback: (territories: Territory[]) => void): () => void
}

/* ===========================================
   LOCAL / INDEXEDDB ADAPTER
   =========================================== */

const DB_NAME = 'asg-territories'
const DB_VERSION = 1
const STORE_NAME = 'territories'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('officeId', 'officeId', { unique: false })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('createdBy', 'createdBy', { unique: false })
        store.createIndex('assignedUserIds', 'assignedUserIds', { unique: false, multiEntry: true })
      }
    }
  })
}

function generateId(): string {
  return `terr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function nowISO(): string {
  return new Date().toISOString()
}

export class LocalTerritoryRepository implements TerritoryRepository {
  private dbPromise: Promise<IDBDatabase> | null = null
  private subscribers = new Set<(territories: Territory[]) => void>()
  
  private async getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB()
    }
    return this.dbPromise
  }
  
  private async notifySubscribers() {
    const territories = await this.list()
    this.subscribers.forEach(cb => cb(territories))
  }
  
  async list(): Promise<Territory[]> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result as Territory[])
      request.onerror = () => reject(request.error)
    })
  }
  
  async listWithStats(): Promise<TerritoryWithStats[]> {
    // For now, just return territories with empty stats
    // Future: compute stats from pins
    const territories = await this.list()
    return territories.map(t => ({ ...t, pinCount: 0, leadCount: 0, activityCount: 0 }))
  }
  
  async get(id: string): Promise<Territory | null> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(id)
      request.onsuccess = () => resolve((request.result as Territory) ?? null)
      request.onerror = () => reject(request.error)
    })
  }
  
  async create(input: CreateTerritoryInput): Promise<Territory> {
    const db = await this.getDB()
    const territory: Territory = {
      id: generateId(),
      name: input.name,
      assignedUserIds: input.assignedUserIds ?? [],
      geometry: input.geometry,
      geometryType: input.geometryType,
      status: input.status ?? 'active',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      createdBy: 'local-user',
    }
    if (input.officeId !== undefined) {
      territory.officeId = input.officeId
    }
    if (input.teamId !== undefined) {
      territory.teamId = input.teamId
    }
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.add(territory)
      request.onsuccess = () => {
        this.notifySubscribers()
        resolve(territory)
      }
      request.onerror = () => reject(request.error)
    })
  }
  
  async update(id: string, input: UpdateTerritoryInput): Promise<Territory> {
    const existing = await this.get(id)
    if (!existing) throw new Error(`Territory ${id} not found`)
    
    const updated: Territory = {
      ...existing,
      name: input.name !== undefined ? input.name : existing.name,
      assignedUserIds: input.assignedUserIds !== undefined ? input.assignedUserIds : existing.assignedUserIds,
      geometry: input.geometry !== undefined ? input.geometry : existing.geometry,
      geometryType: input.geometryType !== undefined ? input.geometryType : existing.geometryType,
      status: input.status !== undefined ? input.status : existing.status,
      updatedAt: nowISO(),
    }
    // officeId
    if (input.officeId !== undefined) {
      if (input.officeId === null) {
        delete updated.officeId
      } else {
        updated.officeId = input.officeId
      }
    }
    // teamId
    if (input.teamId !== undefined) {
      if (input.teamId === null) {
        delete updated.teamId
      } else {
        updated.teamId = input.teamId
      }
    }
    
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(updated)
      request.onsuccess = () => {
        this.notifySubscribers()
        resolve(updated)
      }
      request.onerror = () => reject(request.error)
    })
  }
  
  async delete(id: string): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(id)
      request.onsuccess = () => {
        this.notifySubscribers()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }
  
  async assign(id: string, input: AssignTerritoryInput): Promise<Territory> {
    const territory = await this.get(id)
    if (!territory) throw new Error(`Territory ${id} not found`)
    
    let assignedUserIds: string[]
    switch (input.mode) {
      case 'replace':
        assignedUserIds = input.userIds
        break
      case 'add':
        assignedUserIds = [...new Set([...territory.assignedUserIds, ...input.userIds])]
        break
      case 'remove':
        assignedUserIds = territory.assignedUserIds.filter(u => !input.userIds.includes(u))
        break
    }
    
    return this.update(id, { assignedUserIds })
  }
  
  async getByUserId(userId: string): Promise<Territory[]> {
    const all = await this.list()
    return all.filter(t => t.assignedUserIds.includes(userId))
  }
  
  async getByOfficeId(officeId: 'perth' | 'brisbane'): Promise<Territory[]> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const index = store.index('officeId')
      const request = index.getAll(officeId)
      request.onsuccess = () => resolve(request.result as Territory[])
      request.onerror = () => reject(request.error)
    })
  }
  
  subscribe(callback: (territories: Territory[]) => void): () => void {
    this.subscribers.add(callback)
    // Initial fire
    this.list().then(callback).catch(console.error)
    return () => this.subscribers.delete(callback)
  }
}

/* ===========================================
   FIREBASE ADAPTER INTERFACE (NOT IMPLEMENTED)
   =========================================== */

/*
export class FirebaseTerritoryRepository implements TerritoryRepository {
  constructor(private firestore: FirebaseFirestore.Firestore) {}
  
  async list(): Promise<Territory[]> {
    const snapshot = await this.firestore.collection('territories').get()
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory))
  }
  
  async listWithStats(): Promise<TerritoryWithStats[]> {
    // Use aggregation queries or Cloud Functions for stats
    throw new Error('Not implemented')
  }
  
  async get(id: string): Promise<Territory | null> {
    const doc = await this.firestore.collection('territories').doc(id).get()
    return doc.exists ? { id: doc.id, ...doc.data() } as Territory : null
  }
  
  async create(input: CreateTerritoryInput): Promise<Territory> {
    const ref = this.firestore.collection('territories').doc()
    const territory: Territory = {
      id: ref.id,
      ...input,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    } as Territory
    await ref.set(territory)
    return territory
  }
  
  async update(id: string, input: UpdateTerritoryInput): Promise<Territory> {
    const ref = this.firestore.collection('territories').doc(id)
    await ref.update({ ...input, updatedAt: FieldValue.serverTimestamp() })
    const updated = await ref.get()
    return { id: updated.id, ...updated.data() } as Territory
  }
  
  async delete(id: string): Promise<void> {
    await this.firestore.collection('territories').doc(id).delete()
  }
  
  async assign(id: string, input: AssignTerritoryInput): Promise<Territory> {
    const territory = await this.get(id)
    if (!territory) throw new Error(`Territory ${id} not found`)
    
    let assignedUserIds: string[]
    switch (input.mode) {
      case 'replace': assignedUserIds = input.userIds; break
      case 'add': assignedUserIds = [...new Set([...territory.assignedUserIds, ...input.userIds])]; break
      case 'remove': assignedUserIds = territory.assignedUserIds.filter(u => !input.userIds.includes(u)); break
    }
    
    return this.update(id, { assignedUserIds })
  }
  
  async getByUserId(userId: string): Promise<Territory[]> {
    const snapshot = await this.firestore
      .collection('territories')
      .where('assignedUserIds', 'array-contains', userId)
      .get()
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory))
  }
  
  async getByOfficeId(officeId: 'perth' | 'brisbane'): Promise<Territory[]> {
    const snapshot = await this.firestore
      .collection('territories')
      .where('officeId', '==', officeId)
      .get()
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory))
  }
  
  subscribe(callback: (territories: Territory[]) => void): () => void {
    const unsubscribe = this.firestore
      .collection('territories')
      .onSnapshot(snapshot => {
        const territories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory))
        callback(territories)
      })
    return unsubscribe
  }
}
*/

/* ===========================================
   REPOSITORY FACTORY
   =========================================== */

let repositoryInstance: TerritoryRepository | null = null

export function getTerritoryRepository(): TerritoryRepository {
  if (!repositoryInstance) {
    repositoryInstance = new LocalTerritoryRepository()
  }
  return repositoryInstance
}

export function setTerritoryRepository(repo: TerritoryRepository): void {
  repositoryInstance = repo
}
