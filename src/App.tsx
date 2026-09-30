import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useCurrentUser } from './auth'
import { DEFAULT_WORKSPACE_STORAGE_KEY, getDefaultWorkspaceRoute } from './domain/workspaces'
import { RequireAuth, RequireRole } from './components/RouteGuards'
import { MapPage } from './pages/MapPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { LoginPage } from './pages/LoginPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { LeadImportPage } from './pages/LeadImportPage'
import { SetupPinPage } from './pages/SetupPinPage'
import { SetupAdminPage } from './pages/SetupAdminPage'
import { TerritoriesPage } from './pages/TerritoriesPage'
import { CallLogPage } from './pages/CallLogPage'
import './App.css'

function WorkspaceLanding() {
  const currentUser = useCurrentUser()
  let savedWorkspace: string | null = null
  try {
    savedWorkspace = localStorage.getItem(DEFAULT_WORKSPACE_STORAGE_KEY)
  } catch {
    // Private browsing can disable storage; Map remains the default.
  }
  return <Navigate to={getDefaultWorkspaceRoute(currentUser, savedWorkspace)} replace />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup-admin" element={<SetupAdminPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<WorkspaceLanding />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/calls" element={<CallLogPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/setup-pin" element={<SetupPinPage />} />
            <Route
                          path="/admin/users"
                          element={
                            <RequireRole capability="users:manage">
                              <AdminUsersPage />
                            </RequireRole>
                          }
                        />
                        <Route
                          path="/admin/import"
                          element={
                            <RequireRole capability="users:manage">
                              <LeadImportPage />
                            </RequireRole>
                          }
                        />
                        <Route
                          path="/admin/territories"
                          element={
                            <RequireRole capability="users:manage">
                              <TerritoriesPage />
                            </RequireRole>
                          }
                        />
          </Route>
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
