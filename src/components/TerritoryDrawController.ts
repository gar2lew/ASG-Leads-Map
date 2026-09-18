/* ===========================================
   TERRITORY DRAWING UTILITIES (MapLibre native)
   No external dependencies
   =========================================== */

import type { Map } from 'maplibre-gl'
import type { TerritoryGeometry, GeometryType } from '../domain/territories'

export interface DrawModeState {
  mode: 'idle' | 'draw' | 'edit'
  geometryType: GeometryType
  currentCoordinates: number[][][]
  vertices: { lng: number; lat: number }[]
  selectedFeatureId: string | null
}

function closeRing(ring: number[][]): number[][] {
  if (ring.length < 2) return ring
  const first = ring[0]!
  const last = ring[ring.length - 1]!
  const first0 = first[0]!
  const first1 = first[1]!
  if (first0 !== last[0]! || first1 !== last[1]!) {
    return [...ring, [first0, first1]]
  }
  return ring
}

/**
 * Creates a GeoJSON Polygon from an array of {lng, lat} vertices
 */
export function createPolygonFromVertices(vertices: Array<{ lng: number; lat: number }>): TerritoryGeometry {
  if (vertices.length < 3) {
    throw new Error('At least 3 vertices required for a polygon')
  }

  const ring: number[][] = vertices.map(v => [v.lng, v.lat])
  return { type: 'Polygon', coordinates: [closeRing(ring)] }
}

/**
 * Creates a GeoJSON MultiPolygon from multiple polygon rings
 */
export function createMultiPolygonFromRings(rings: number[][][]): TerritoryGeometry {
  return { type: 'MultiPolygon', coordinates: rings }
}

/**
 * Calculates the centroid of a polygon for label placement
 */
export function getPolygonCentroid(geometry: TerritoryGeometry): [number, number] | null {
  let ring: number[][] | undefined
  
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][]
    if (!coords || coords.length === 0) return null
    ring = coords[0]!
  } else if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates as number[][][][]
    if (!polys || polys.length === 0) return null
    const firstPoly = polys[0]!
    if (!firstPoly || firstPoly.length === 0) return null
    ring = firstPoly[0]!
  }
  
  if (!ring || ring.length === 0) return null
  
  let cx = 0, cy = 0
  for (let i = 0; i < ring.length; i++) {
    const coord = ring[i]
    cx += coord?.[0] ?? 0
    cy += coord?.[1] ?? 0
  }
  return [cx / ring.length, cy / ring.length]
}

function getRingFromGeometry(geometry: TerritoryGeometry): number[][] | undefined {
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][]
    if (!coords || coords.length === 0) return undefined
    return coords[0]!
  }
  const polys = geometry.coordinates as number[][][][]
  if (!polys || polys.length === 0) return undefined
  const firstPoly = polys[0]!
  if (!firstPoly || firstPoly.length === 0) return undefined
  return firstPoly[0]!
}

/**
 * MapLibre Draw Control Setup
 */
export class TerritoryDrawController {
  private map: Map
  private sourceId = 'territory-draw-source'
  private layerIds = {
    fill: 'territory-draw-fill',
    outline: 'territory-draw-outline',
    vertex: 'territory-draw-vertex',
    vertexHalo: 'territory-draw-vertex-halo',
  }
  private state: DrawModeState = {
    mode: 'idle',
    geometryType: 'Polygon',
    currentCoordinates: [] as number[][][],
    vertices: [],
    selectedFeatureId: null,
  }
  private callbacks: {
    onDrawComplete?: (geometry: TerritoryGeometry) => void
    onEditComplete?: (geometry: TerritoryGeometry) => void
    onCancel?: () => void
    onDelete?: () => void
  } = {}
  private clickListener: ((e: any) => void) | null = null
  private moveListener: ((e: any) => void) | null = null
  private keyListener: ((e: KeyboardEvent) => void) | null = null
  private mouseUpListener: (() => void) | null = null

  constructor(map: Map) {
    this.map = map
    this.initSourceAndLayers()
  }

  private initSourceAndLayers() {
    this.map.addSource(this.sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    this.map.addLayer({
      id: this.layerIds.fill,
      type: 'fill',
      source: this.sourceId,
      filter: ['==', '$type', 'Polygon'],
      paint: { 'fill-color': '#B08D46', 'fill-opacity': 0.15, 'fill-outline-color': '#B08D46' },
    })
    this.map.addLayer({
      id: this.layerIds.outline,
      type: 'line',
      source: this.sourceId,
      filter: ['==', '$type', 'Polygon'],
      paint: { 'line-color': '#B08D46', 'line-width': 2, 'line-dasharray': [4, 4] },
    })
    this.map.addLayer({
      id: this.layerIds.vertexHalo,
      type: 'circle',
      source: this.sourceId,
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],
      paint: { 'circle-radius': 8, 'circle-color': '#FFFFFF', 'circle-stroke-width': 2, 'circle-stroke-color': '#B08D46' },
    })
    this.map.addLayer({
      id: this.layerIds.vertex,
      type: 'circle',
      source: this.sourceId,
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],
      paint: { 'circle-radius': 5, 'circle-color': '#B08D46' },
    })
  }

  setCallbacks(callbacks: typeof this.callbacks) {
    this.callbacks = callbacks
  }

  startDraw(geometryType: GeometryType = 'Polygon') {
    this.state = { mode: 'draw', geometryType, currentCoordinates: [], vertices: [], selectedFeatureId: null }
    this.updateDrawSource(undefined)
    this.attachDrawListeners()
    this.map.getCanvas().style.cursor = 'crosshair'
  }

  startEdit(geometry: TerritoryGeometry) {
    const vertices: Array<{ lng: number; lat: number }> = []
    const ring = getRingFromGeometry(geometry)
    
    if (ring && ring.length > 1) {
      const lastIdx = ring.length - 1
      for (let i = 0; i < lastIdx; i++) {
        const c = ring[i]
        if (c && c.length >= 2) {
          vertices.push({ lng: c[0]!, lat: c[1]! })
        }
      }
    }
    
    this.state = { 
      mode: 'edit', 
      geometryType: geometry.type, 
      currentCoordinates: geometry.type === 'Polygon' ? geometry.coordinates as number[][][] : [] as number[][][],
      vertices, 
      selectedFeatureId: 'editing' 
    }
    this.updateDrawSource(undefined)
    this.attachEditListeners()
    this.map.getCanvas().style.cursor = 'grab'
  }

  cancel() {
    this.detachListeners()
    this.state = { mode: 'idle', geometryType: 'Polygon', currentCoordinates: [], vertices: [], selectedFeatureId: null }
    this.updateDrawSource(undefined)
    this.map.getCanvas().style.cursor = ''
    this.callbacks.onCancel?.()
  }

  finish() {
    if (this.state.mode === 'draw' && this.state.vertices.length >= 3) {
      const geometry = createPolygonFromVertices(this.state.vertices)
      this.detachListeners()
      this.state = { mode: 'idle', geometryType: 'Polygon', currentCoordinates: [], vertices: [], selectedFeatureId: null }
      this.updateDrawSource(undefined)
      this.map.getCanvas().style.cursor = ''
      this.callbacks.onDrawComplete?.(geometry)
    } else if (this.state.mode === 'edit' && this.state.vertices.length >= 3) {
      const ring: number[][] = this.state.vertices.map(v => [v.lng, v.lat])
      const closedRing = closeRing(ring)
      
      const geometry: TerritoryGeometry = {
        type: this.state.geometryType,
        coordinates: [closedRing],
      }
      this.detachListeners()
      this.state = { mode: 'idle', geometryType: 'Polygon', currentCoordinates: [], vertices: [], selectedFeatureId: null }
      this.updateDrawSource(undefined)
      this.map.getCanvas().style.cursor = ''
      this.callbacks.onEditComplete?.(geometry)
    }
  }

  deleteEdit() {
    this.detachListeners()
    this.state = { mode: 'idle', geometryType: 'Polygon', currentCoordinates: [], vertices: [], selectedFeatureId: null }
    this.updateDrawSource(undefined)
    this.map.getCanvas().style.cursor = ''
    this.callbacks.onDelete?.()
  }

  private attachDrawListeners() {
    this.clickListener = (e: any) => {
      if (this.state.mode !== 'draw') return
      const lngLat = e?.lngLat
      if (lngLat && typeof lngLat.lng === 'number' && typeof lngLat.lat === 'number') {
        this.state.vertices.push({ lng: lngLat.lng, lat: lngLat.lat })
        this.updateDrawSource(undefined)
      }
    }
    this.moveListener = (e: any) => {
      if (this.state.mode !== 'draw' || this.state.vertices.length === 0) return
      this.updateDrawSource(e?.lngLat)
    }
    this.keyListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.cancel()
      else if (e.key === 'Enter' && this.state.vertices.length >= 3) this.finish()
    }
    this.map.on('click', this.clickListener)
    this.map.on('mousemove', this.moveListener)
    document.addEventListener('keydown', this.keyListener)
  }

  private attachEditListeners() {
    let draggedVertexIndex: number | null = null

    this.clickListener = (e: any) => {
      if (this.state.mode !== 'edit') return
      const features = this.map.queryRenderedFeatures(e.point, { layers: [this.layerIds.vertex] })
      if (features && features.length > 0 && features[0]) {
        const props = features[0].properties ?? {}
        const idx = props['vertexIndex']
        draggedVertexIndex = typeof idx === 'number' ? idx : null
        this.map.dragPan.disable()
      }
    }
    this.moveListener = (e: any) => {
      if (draggedVertexIndex !== null && this.state.vertices[draggedVertexIndex]) {
        const lngLat = e?.lngLat
        if (lngLat && typeof lngLat.lng === 'number' && typeof lngLat.lat === 'number') {
          this.state.vertices[draggedVertexIndex] = { lng: lngLat.lng, lat: lngLat.lat }
          this.updateDrawSource(undefined)
        }
      }
    }
    this.keyListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (draggedVertexIndex !== null) { draggedVertexIndex = null; this.map.dragPan.enable() }
        else this.cancel()
      } else if (e.key === 'Enter') { this.finish() }
      else if (e.key === 'Delete' || e.key === 'Backspace') { this.deleteEdit() }
    }
    const mouseUpListener = () => {
      if (draggedVertexIndex !== null) { draggedVertexIndex = null; this.map.dragPan.enable() }
    }
    this.map.on('click', this.clickListener)
    this.map.on('mousemove', this.moveListener)
    this.map.on('mouseup', mouseUpListener)
    document.addEventListener('keydown', this.keyListener)
    this.mouseUpListener = mouseUpListener
  }

  private detachListeners() {
    if (this.clickListener) this.map.off('click', this.clickListener)
    if (this.moveListener) this.map.off('mousemove', this.moveListener)
    if (this.keyListener) document.removeEventListener('keydown', this.keyListener)
    if (this.mouseUpListener) this.map.off('mouseup', this.mouseUpListener)
    this.clickListener = null
    this.moveListener = null
    this.keyListener = null
    this.mouseUpListener = null
    this.map.dragPan.enable()
  }

  private updateDrawSource(previewLngLat: { lng: number; lat: number } | undefined) {
    const features: any[] = []
    if (this.state.vertices.length === 0) {
      const source = this.map.getSource(this.sourceId)
      if (source) (source as any).setData({ type: 'FeatureCollection', features })
      return
    }

    const ring: number[][] = this.state.vertices.map(v => [v.lng, v.lat])
    const displayRing = previewLngLat ? closeRing([...ring, [previewLngLat.lng, previewLngLat.lat]]) : closeRing(ring)

    if (displayRing.length >= 4) {
      features.push({ type: 'Feature', id: 'drawing-polygon', geometry: { type: 'Polygon', coordinates: [displayRing] }, properties: {} })
    }

    this.state.vertices.forEach((v, i) => {
      features.push({ type: 'Feature', id: `vertex-${i}`, geometry: { type: 'Point', coordinates: [v.lng, v.lat] }, properties: { meta: 'vertex', vertexIndex: i } })
    })

    const source = this.map.getSource(this.sourceId)
    if (source) (source as any).setData({ type: 'FeatureCollection', features })
  }

  showTerritories(territories: Array<{ id: string; geometry: any; name: string; officeId: string; status: string }>) {
    const features = territories.filter(t => t.geometry).map(t => ({
      type: 'Feature', id: t.id, geometry: t.geometry,
      properties: { name: t.name, officeId: t.officeId, status: t.status },
    }))
    const source = this.map.getSource(this.sourceId)
    if (source) (source as any).setData({ type: 'FeatureCollection', features })
  }

  clear() {
    const source = this.map.getSource(this.sourceId)
    if (source) (source as any).setData({ type: 'FeatureCollection', features: [] })
  }

  destroy() {
    this.detachListeners()
    try {
      for (const id of [this.layerIds.vertex, this.layerIds.vertexHalo, this.layerIds.outline, this.layerIds.fill]) {
        if (this.map.getLayer(id)) this.map.removeLayer(id)
      }
      if (this.map.getSource(this.sourceId)) this.map.removeSource(this.sourceId)
    } catch { /* ignore cleanup errors */ }
  }

  getState() { return { ...this.state } }
}

export function addTerritoryLayers(map: Map, sourceId = 'territories') {
  map.addLayer({
    id: 'territories-fill', type: 'fill', source: sourceId,
    paint: { 'fill-color': ['match', ['get', 'status'], 'active', '#B08D46', 'inactive', '#94A3B8', 'draft', '#D97706', '#B08D46'], 'fill-opacity': 0.08 },
  })
  map.addLayer({
    id: 'territories-outline', type: 'line', source: sourceId,
    paint: { 'line-color': ['match', ['get', 'status'], 'active', '#B08D46', 'inactive', '#94A3B8', 'draft', '#D97706', '#B08D46'], 'line-width': 2, 'line-opacity': 0.8 },
  })
  map.addLayer({
    id: 'territories-hover', type: 'line', source: sourceId, filter: ['==', 'id', ''],
    paint: { 'line-color': '#FFFFFF', 'line-width': 4, 'line-opacity': 1 },
  })
}

export function removeTerritoryLayers(map: Map) {
  ['territories-hover', 'territories-outline', 'territories-fill'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id)
  })
}

export function updateTerritoryHighlight(map: Map, territoryId: string | null) {
  const hoverLayer = map.getLayer('territories-hover')
  if (hoverLayer) map.setFilter('territories-hover', territoryId ? ['==', 'id', territoryId] : ['==', 'id', ''])
}
