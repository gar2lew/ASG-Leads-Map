/* ===========================================
   TERRITORY DOMAIN MODEL
   Local-first, Firebase-ready via repository adapter
   =========================================== */

export type GeometryType = 'Polygon' | 'MultiPolygon'

export interface TerritoryGeometry {
  type: GeometryType
  coordinates: number[][][] | number[][][][]  // GeoJSON coordinate format
}

export interface Territory {
  id: string
  name: string
  officeId?: 'perth' | 'brisbane'
  teamId?: string
  assignedUserIds: string[]
  geometry: TerritoryGeometry
  geometryType: GeometryType
  status: 'active' | 'inactive' | 'draft'
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface CreateTerritoryInput {
  name: string
  officeId?: 'perth' | 'brisbane'
  teamId?: string
  assignedUserIds?: string[]
  geometry: TerritoryGeometry
  geometryType: GeometryType
  status?: 'active' | 'inactive' | 'draft'
}

export interface UpdateTerritoryInput {
  name?: string
  officeId?: 'perth' | 'brisbane' | null
  teamId?: string | null
  assignedUserIds?: string[]
  geometry?: TerritoryGeometry
  geometryType?: GeometryType
  status?: 'active' | 'inactive' | 'draft'
}

export interface AssignTerritoryInput {
  userIds: string[]
  mode: 'replace' | 'add' | 'remove'
}

export interface TerritoryWithStats extends Territory {
  pinCount?: number
  leadCount?: number
  activityCount?: number
}
