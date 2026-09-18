import { useEffect, useState, useCallback, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../auth'
import { canManageTerritories, canViewAllTerritories } from '../domain/territoryPermissions'
import { getTerritoryRepository } from '../domain/territoryRepository'
import type { Territory, CreateTerritoryInput, UpdateTerritoryInput, AssignTerritoryInput } from '../domain/territories'
import { TerritoryDrawController, addTerritoryLayers, removeTerritoryLayers, updateTerritoryHighlight } from '../components/TerritoryDrawController'
import './TerritoriesPage.css'

export function TerritoriesPage() {
  const currentUser = useCurrentUser()
  const canManage = canManageTerritories(currentUser.role)
  const canView = canViewAllTerritories(currentUser.role)
  
  const [territories, setTerritories] = useState<Territory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [rowBusy] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [editingTerritory, setEditingTerritory] = useState<Territory | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  
  // Create form state
  const [createName, setCreateName] = useState('')
  const [createOfficeId, setCreateOfficeId] = useState<'perth' | 'brisbane'>('perth')
  const [createTeamId, setCreateTeamId] = useState('')
  const [createStatus, setCreateStatus] = useState<'active' | 'inactive' | 'draft'>('active')
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawGeometry, setDrawGeometry] = useState<Territory | null>(null)
  
  // Edit form state
  const [editName, setEditName] = useState('')
  const [editOfficeId, setEditOfficeId] = useState<'perth' | 'brisbane'>('perth')
  const [editTeamId, setEditTeamId] = useState('')
  const [editStatus, setEditStatus] = useState<'active' | 'inactive' | 'draft'>('active')
  const [editAssignedUserIds, setEditAssignedUserIds] = useState<string[]>([])
  const [editError, setEditError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isEditDrawing, setIsEditDrawing] = useState(false)
  
  // Assign modal state
  const [assignUserIds, setAssignUserIds] = useState<string[]>([])
  const [assignMode, setAssignMode] = useState<'replace' | 'add' | 'remove'>('replace')
  const [assignError, setAssignError] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)
  
  // Add state to track draw vertices count for banner
  const [drawVertexCount, setDrawVertexCount] = useState(0)
  
  // Sync draw vertex count from controller
  useEffect(() => {
    if (!drawControllerRef.current) return
    const interval = setInterval(() => {
      if (isDrawing || isEditDrawing) {
        setDrawVertexCount(drawControllerRef.current?.getState().vertices.length ?? 0)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [isDrawing, isEditDrawing])
  
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const drawControllerRef = useRef<TerritoryDrawController | null>(null)
  const territorySourceId = 'territories-source'
  
  const repo = getTerritoryRepository()
  
  const loadTerritories = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await repo.listWithStats()
      setTerritories(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load territories')
    } finally {
      setIsLoading(false)
    }
  }, [repo])
  
  useEffect(() => {
    loadTerritories()
    const unsubscribe = repo.subscribe(loadTerritories)
    return () => unsubscribe()
  }, [loadTerritories, repo])
  
  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 19,
            attribution: 'Tiles &copy; Esri',
          },
        },
        layers: [
          {
            id: 'satellite',
            type: 'raster',
            source: 'satellite',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [115.8605, -31.9505],
      zoom: 10,
      attributionControl: false,
    })
    
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.FullscreenControl(), 'top-right')
    
    mapRef.current = map
    drawControllerRef.current = new TerritoryDrawController(map)
    
    drawControllerRef.current.setCallbacks({
      onDrawComplete: (geometry) => {
        setDrawGeometry({ geometry, geometryType: geometry.type } as any)
        setIsDrawing(false)
      },
      onEditComplete: (geometry) => {
        setEditingTerritory(prev => prev ? { ...prev, geometry, geometryType: geometry.type } : null)
        setIsEditDrawing(false)
      },
      onCancel: () => {
        setIsDrawing(false)
        setIsEditDrawing(false)
        setDrawGeometry(null)
      },
      onDelete: () => {
        setIsEditDrawing(false)
      },
    })
    
    addTerritoryLayers(map, territorySourceId)
    map.addSource(territorySourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    
    const features = territories
      .filter(t => t.geometry)
      .map(t => ({
        type: 'Feature',
        id: t.id,
        geometry: t.geometry,
        properties: { name: t.name, officeId: t.officeId, status: t.status },
      }))
    
    const source = map.getSource(territorySourceId)
    if (source) {
      (source as any).setData({ type: 'FeatureCollection', features })
    }
    
    let hoveredId: string | null = null
    map.on('mousemove', 'territories-fill', (e) => {
      if (e.features && e.features.length > 0 && e.features[0]) {
        const id = e.features[0].id as string
        if (id !== hoveredId) {
          hoveredId = id
          updateTerritoryHighlight(map, id)
          map.getCanvas().style.cursor = 'pointer'
        }
      } else if (hoveredId) {
        hoveredId = null
        updateTerritoryHighlight(map, null)
        map.getCanvas().style.cursor = ''
      }
    })
    
    map.on('mouseleave', 'territories-fill', () => {
      hoveredId = null
      updateTerritoryHighlight(map, null)
      map.getCanvas().style.cursor = ''
    })
    
    return () => {
      removeTerritoryLayers(map)
      if (map.getSource(territorySourceId)) map.removeSource(territorySourceId)
      drawControllerRef.current?.destroy()
      map.remove()
      mapRef.current = null
    }
  }, [territories])
  
  // Update territory source when territories change
  useEffect(() => {
    if (!mapRef.current) return
    const features = territories
      .filter(t => t.geometry)
      .map(t => ({
        type: 'Feature',
        id: t.id,
        geometry: t.geometry,
        properties: { name: t.name, officeId: t.officeId, status: t.status },
      }))
    const source = mapRef.current.getSource(territorySourceId)
    if (source) {
      (source as any).setData({ type: 'FeatureCollection', features })
    }
  }, [territories])
  
  if (!canView) {
    return <Navigate to="/map" replace />
  }
  
  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!createName.trim()) return
    if (!drawGeometry) {
      setCreateError('Please draw a territory boundary on the map first')
      return
    }
    
    setCreateError(null)
    setIsCreating(true)
    try {
      const input: CreateTerritoryInput = {
        name: createName.trim(),
        geometry: drawGeometry.geometry,
        geometryType: drawGeometry.geometryType,
        status: createStatus,
      }
      if (createOfficeId) input.officeId = createOfficeId
      if (createTeamId.trim()) input.teamId = createTeamId.trim()
      
      await repo.create(input)
      setShowCreate(false)
      setCreateName('')
      setCreateOfficeId('perth')
      setCreateTeamId('')
      setCreateStatus('active')
      setDrawGeometry(null)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create territory')
    } finally {
      setIsCreating(false)
    }
  }
  
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTerritory || !editName.trim()) return
    
    setEditError(null)
    setIsEditing(true)
    try {
      const input: UpdateTerritoryInput = {
        name: editName.trim(),
      }
      if (editOfficeId) input.officeId = editOfficeId
      if (editTeamId.trim()) input.teamId = editTeamId.trim()
      
      await repo.update(editingTerritory.id, input)
      setEditingTerritory(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update territory')
    } finally {
      setIsEditing(false)
    }
  }
  
  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!assigningId || assignUserIds.length === 0) return
    
    setAssignError(null)
    setIsAssigning(true)
    try {
      const input: AssignTerritoryInput = {
        userIds: assignUserIds,
        mode: assignMode,
      }
      await repo.assign(assigningId, input)
      setAssigningId(null)
      setAssignUserIds([])
      setAssignMode('replace')
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign territory')
    } finally {
      setIsAssigning(false)
    }
  }
  
  async function handleDelete() {
    if (!deletingId || !confirm('Delete this territory?')) return
    
    try {
      await repo.delete(deletingId)
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Failed to delete territory')
    } finally {
      setDeletingId(null)
    }
  }
  
  function startCreateDrawing() {
    setIsDrawing(true)
    drawControllerRef.current?.startDraw('Polygon')
  }
  
  function startEditDrawing() {
    if (!editingTerritory?.geometry) return
    setIsEditDrawing(true)
    drawControllerRef.current?.startEdit(editingTerritory.geometry)
  }
  
  function cancelDrawing() {
    drawControllerRef.current?.cancel()
    setIsDrawing(false)
    setIsEditDrawing(false)
    setDrawGeometry(null)
  }
  
  function finishDrawing() {
    drawControllerRef.current?.finish()
  }
  
  function openEdit(territory: Territory) {
    setEditingTerritory(territory)
    setEditName(territory.name)
    setEditOfficeId(territory.officeId ?? 'perth')
    setEditTeamId(territory.teamId ?? '')
    setEditStatus(territory.status)
    setEditAssignedUserIds(territory.assignedUserIds ?? [])
    setEditError(null)
  }
  
  function openAssign(territory: Territory) {
    setAssigningId(territory.id)
    setAssignUserIds(territory.assignedUserIds ?? [])
    setAssignMode('replace')
    setAssignError(null)
  }
  
  function confirmDelete(id: string) {
    setDeletingId(id)
  }
  
  return (
    <section className="territories-page" aria-label="Territory management">
      <header className="territories-page__header">
        <div>
          <span className="territories-page__eyebrow">Administration</span>
          <h1 className="territories-page__title">Territories</h1>
          <p className="territories-page__summary">{territories.length} territories</p>
        </div>
        {canManage && (
          <div className="territories-page__actions">
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => {
                setShowCreate(true)
                setCreateError(null)
                setDrawGeometry(null)
              }}
              disabled={isDrawing}
            >
              <svg className="icon btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create Territory
            </button>
          </div>
        )}
      </header>
      
      {rowError && (
        <p className="territories-page__error" role="alert">{rowError}</p>
      )}
      
      {error && (
        <p className="territories-page__error" role="alert">{error}</p>
      )}
      
      {isLoading ? (
        <p className="territories-page__loading">Loading territories…</p>
      ) : territories.length === 0 ? (
        <p className="territories-page__empty">No territories yet. Create one to get started.</p>
      ) : (
        <div className="territories-page__layout">
          <aside className="territories-page__list-panel card">
            <div className="territories-page__list-header">
              <h2 className="territories-page__list-title">Territories</h2>
              {canManage && isDrawing && (
                <button className="btn btn--secondary btn--sm" type="button" onClick={cancelDrawing}>
                  Cancel Drawing
                </button>
              )}
            </div>
            <ul className="territories-page__list" role="list">
              {territories.map(territory => (
                <li
                  key={territory.id}
                  className={`territories-page__item ${territory.id === editingTerritory?.id ? 'territories-page__item--editing' : ''} ${territory.id === assigningId ? 'territories-page__item--assigning' : ''}`}
                >
                  <div className="territories-page__item-main">
                    <div className="territories-page__item-accent" style={{ backgroundColor: territory.status === 'active' ? '#B08D46' : territory.status === 'inactive' ? '#94A3B8' : '#D97706' }} />
                    <div className="territories-page__item-info">
                      <span className="territories-page__item-name">{territory.name}</span>
                      <span className="territories-page__item-meta">
                        {territory.officeId ? (territory.officeId === 'perth' ? 'Perth' : 'Brisbane') : 'Unassigned'}
                        {territory.teamId && ` · ${territory.teamId}`}
                        {territory.assignedUserIds.length > 0 && ` · ${territory.assignedUserIds.length} rep${territory.assignedUserIds.length > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <span className={`territories-page__item-status territories-page__item-status--${territory.status}`}>
                      {territory.status}
                    </span>
                  </div>
                  <div className="territories-page__item-actions">
                    {canManage && (
                      <>
                        <button
                          className="btn btn--ghost btn--sm"
                          type="button"
                          onClick={() => openEdit(territory)}
                          disabled={rowBusy === territory.id}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          type="button"
                          onClick={() => openAssign(territory)}
                          disabled={rowBusy === territory.id}
                        >
                          Assign
                        </button>
                        <button
                          className="btn btn--ghost btn--sm btn--danger"
                          type="button"
                          onClick={() => confirmDelete(territory.id)}
                          disabled={rowBusy === territory.id}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </aside>
          
          <div className="territories-page__map-panel">
            <div ref={mapContainerRef} className="territories-page__map" />
            {(isDrawing || isEditDrawing) && (
              <div className="territories-page__draw-banner" role="status" aria-live="polite">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span>
                  {isDrawing 
                    ? `Click to add vertices (${drawVertexCount} points). Minimum 3 points. Press Enter to finish, Escape to cancel.`
                    : 'Drag vertices to adjust. Press Enter to save, Escape to cancel, Delete to remove.'
                  }
                </span>
                <div className="territories-page__draw-actions">
                  <button className="btn btn--secondary btn--sm" type="button" onClick={cancelDrawing} disabled={isEditing}>
                    Cancel
                  </button>
                  <button
                    className="btn btn--primary btn--sm"
                    type="button"
                    onClick={finishDrawing}
                    disabled={isDrawing && drawVertexCount < 3}
                  >
                    {isDrawing ? 'Finish Drawing' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Create Territory Modal */}
      {showCreate && (
        <div className="territories-page__modal-overlay" role="presentation" onClick={(e) => e.target === e.currentTarget && !isDrawing && setShowCreate(false)}>
          <div className="territories-page__modal" role="dialog" aria-modal="true" aria-labelledby="create-territory-title">
            <header className="territories-page__modal-header">
              <div>
                <span className="territories-page__modal-eyebrow">Territory management</span>
                <h2 id="create-territory-title" className="territories-page__modal-title">Create Territory</h2>
              </div>
              <button
                type="button"
                className="territories-page__modal-close"
                aria-label="Close create territory dialog"
                onClick={() => !isDrawing && setShowCreate(false)}
              >
                ×
              </button>
            </header>
            <form className="territories-page__modal-form" onSubmit={handleCreateSubmit} noValidate>
              <div className="territories-page__modal-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="territory-name">Name*</label>
                  <input
                    id="territory-name"
                    className="form-input"
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    required
                    disabled={isDrawing}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="territory-office">Office</label>
                  <select
                    id="territory-office"
                    className="form-input"
                    value={createOfficeId}
                    onChange={(e) => setCreateOfficeId(e.target.value as 'perth' | 'brisbane')}
                    disabled={isDrawing}
                  >
                    <option value="perth">Perth</option>
                    <option value="brisbane">Brisbane</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="territory-team">Team (optional)</label>
                  <input
                    id="territory-team"
                    className="form-input"
                    type="text"
                    value={createTeamId}
                    onChange={(e) => setCreateTeamId(e.target.value)}
                    disabled={isDrawing}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="territory-status">Status</label>
                  <select
                    id="territory-status"
                    className="form-input"
                    value={createStatus}
                    onChange={(e) => setCreateStatus(e.target.value as 'active' | 'inactive' | 'draft')}
                    disabled={isDrawing}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
              
              <div className="territories-page__draw-section">
                <h3 className="territories-page__draw-title">Boundary</h3>
                {drawGeometry ? (
                  <div className="territories-page__draw-preview">
                    <p className="territories-page__draw-success">
                      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Territory boundary drawn. Ready to create.
                    </p>
                    <button className="btn btn--secondary btn--sm" type="button" onClick={() => { setDrawGeometry(null); startCreateDrawing(); }}>
                      Redraw
                    </button>
                  </div>
                ) : (
                  <div className="territories-page__draw-empty">
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <p>No boundary drawn yet</p>
                    <button className="btn btn--primary" type="button" onClick={startCreateDrawing} disabled={isDrawing}>
                      Draw Boundary
                    </button>
                  </div>
                )}
              </div>
              
              {createError && (
                <p className="territories-page__error" role="alert">{createError}</p>
              )}
              
              <footer className="territories-page__modal-footer">
                <button className="btn btn--ghost" type="button" onClick={() => !isDrawing && setShowCreate(false)} disabled={isDrawing}>Cancel</button>
                <button className="btn btn--primary" type="submit" disabled={isCreating || isDrawing || !drawGeometry}>
                  {isCreating ? 'Creating…' : 'Create Territory'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
      
      {/* Edit Territory Modal */}
      {editingTerritory && (
        <div className="territories-page__modal-overlay" role="presentation" onClick={(e) => e.target === e.currentTarget && !isEditDrawing && setEditingTerritory(null)}>
          <div className="territories-page__modal" role="dialog" aria-modal="true" aria-labelledby="edit-territory-title">
            <header className="territories-page__modal-header">
              <div>
                <span className="territories-page__modal-eyebrow">Territory management</span>
                <h2 id="edit-territory-title" className="territories-page__modal-title">Edit Territory</h2>
              </div>
              <button
                type="button"
                className="territories-page__modal-close"
                aria-label="Close edit territory dialog"
                onClick={() => !isEditDrawing && setEditingTerritory(null)}
              >
                ×
              </button>
            </header>
            <form className="territories-page__modal-form" onSubmit={handleEditSubmit} noValidate>
              <div className="territories-page__modal-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-territory-name">Name*</label>
                  <input
                    id="edit-territory-name"
                    className="form-input"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    disabled={isEditDrawing}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-territory-office">Office</label>
                  <select
                    id="edit-territory-office"
                    className="form-input"
                    value={editOfficeId}
                    onChange={(e) => setEditOfficeId(e.target.value as 'perth' | 'brisbane')}
                    disabled={isEditDrawing}
                  >
                    <option value="perth">Perth</option>
                    <option value="brisbane">Brisbane</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-territory-team">Team (optional)</label>
                  <input
                    id="edit-territory-team"
                    className="form-input"
                    type="text"
                    value={editTeamId}
                    onChange={(e) => setEditTeamId(e.target.value)}
                    disabled={isEditDrawing}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-territory-status">Status</label>
                  <select
                    id="edit-territory-status"
                    className="form-input"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive' | 'draft')}
                    disabled={isEditDrawing}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
              
              <div className="territories-page__draw-section">
                <h3 className="territories-page__draw-title">Boundary</h3>
                {editingTerritory.geometry ? (
                  <div className="territories-page__draw-preview">
                    <p className="territories-page__draw-info">
                      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      Boundary exists ({editingTerritory.geometry.type}). Click "Edit Boundary" to modify.
                    </p>
                    <button className="btn btn--secondary" type="button" onClick={startEditDrawing} disabled={isEditDrawing}>
                      Edit Boundary
                    </button>
                  </div>
                ) : (
                  <div className="territories-page__draw-empty">
                    <p>No boundary set</p>
                    <button className="btn btn--primary" type="button" onClick={startEditDrawing} disabled={isEditDrawing}>
                      Draw Boundary
                    </button>
                  </div>
                )}
              </div>
              
              <div className="territories-page__draw-section">
                <h3 className="territories-page__draw-title">Assigned Reps</h3>
                <div className="territories-page__assign-input">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Add rep user ID (comma separated)"
                    value={editAssignedUserIds.join(', ')}
                    onChange={(e) => setEditAssignedUserIds(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  />
                  <p className="form-hint">{editAssignedUserIds.length} rep(s) assigned</p>
                </div>
              </div>
              
              {editError && (
                <p className="territories-page__error" role="alert">{editError}</p>
              )}
              
              <footer className="territories-page__modal-footer">
                <button className="btn btn--ghost" type="button" onClick={() => !isEditDrawing && setEditingTerritory(null)} disabled={isEditDrawing}>Cancel</button>
                <button className="btn btn--primary" type="submit" disabled={isEditing || isEditDrawing}>
                  {isEditing ? 'Saving…' : 'Save Changes'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
      
      {/* Assign Territory Modal */}
      {assigningId && (
        <div className="territories-page__modal-overlay" role="presentation" onClick={(e) => e.target === e.currentTarget && setAssigningId(null)}>
          <div className="territories-page__modal territories-page__modal--small" role="dialog" aria-modal="true" aria-labelledby="assign-territory-title">
            <header className="territories-page__modal-header">
              <div>
                <span className="territories-page__modal-eyebrow">Territory management</span>
                <h2 id="assign-territory-title" className="territories-page__modal-title">Assign Reps</h2>
              </div>
              <button
                type="button"
                className="territories-page__modal-close"
                aria-label="Close assign territory dialog"
                onClick={() => setAssigningId(null)}
              >
                ×
              </button>
            </header>
            <form className="territories-page__modal-form" onSubmit={handleAssignSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="assign-user-ids">Rep User IDs*</label>
                <input
                  id="assign-user-ids"
                  className="form-input"
                  type="text"
                  placeholder="Comma-separated user IDs"
                  value={assignUserIds.join(', ')}
                  onChange={(e) => setAssignUserIds(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="assign-mode">Mode</label>
                <select
                  id="assign-mode"
                  className="form-input"
                  value={assignMode}
                  onChange={(e) => setAssignMode(e.target.value as 'replace' | 'add' | 'remove')}
                >
                  <option value="replace">Replace all assignments</option>
                  <option value="add">Add to existing assignments</option>
                  <option value="remove">Remove from assignments</option>
                </select>
              </div>
              {assignError && (
                <p className="territories-page__error" role="alert">{assignError}</p>
              )}
              <footer className="territories-page__modal-footer">
                <button className="btn btn--ghost" type="button" onClick={() => setAssigningId(null)}>Cancel</button>
                <button className="btn btn--primary" type="submit" disabled={isAssigning || assignUserIds.length === 0}>
                  {isAssigning ? 'Assigning…' : 'Assign'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation */}
      {deletingId && (
        <div className="territories-page__modal-overlay" role="presentation" onClick={(e) => e.target === e.currentTarget && setDeletingId(null)}>
          <div className="territories-page__modal territories-page__modal--small territories-page__modal--danger" role="dialog" aria-modal="true" aria-labelledby="delete-territory-title">
            <header className="territories-page__modal-header">
              <div>
                <span className="territories-page__modal-eyebrow" style={{ color: 'var(--asg-color-error)' }}>Delete territory</span>
                <h2 id="delete-territory-title" className="territories-page__modal-title">Delete Territory?</h2>
              </div>
            </header>
            <div className="territories-page__modal-form">
              <p>This action cannot be undone. The territory and all its assignments will be permanently removed.</p>
              <footer className="territories-page__modal-footer">
                <button className="btn btn--ghost" type="button" onClick={() => setDeletingId(null)}>Cancel</button>
                <button className="btn btn--danger" type="button" onClick={handleDelete}>Delete Territory</button>
              </footer>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
