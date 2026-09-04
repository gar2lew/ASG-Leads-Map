import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth'
import { RequireAuth, RequireRole } from './components/RouteGuards'
import { MapPage } from './pages/MapPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { LoginPage } from './pages/LoginPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Navigate to="/map" replace />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="/admin/users"
              element={
                <RequireRole capability="users:manage">
                  <AdminUsersPage />
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