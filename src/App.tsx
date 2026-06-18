import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/layout/Layout'
import { ModuleShell } from './components/layout/ModuleShell'
import Login from './pages/Login'
import AccessDenied from './pages/AccessDenied'
import SuiteHome from './pages/Suite/SuiteHome'
import SuiteSettings from './pages/Suite/SuiteSettings'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import EmployeeProfile from './pages/Employees/EmployeeProfile'
import Payroll from './pages/Payroll'
import History from './pages/History'
import Connectors from './pages/Connectors'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/access-denied" element={<AccessDenied />} />

          {/* Default → Spectra Suite home */}
          <Route path="/" element={<Navigate to="/suite" replace />} />
          <Route
            path="/suite"
            element={
              <ProtectedRoute>
                <SuiteHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/suite/settings"
            element={
              <ProtectedRoute requireSuperAdmin>
                <SuiteSettings />
              </ProtectedRoute>
            }
          />

          {/* Nómina module (the existing payroll app) */}
          <Route
            path="/nomina"
            element={
              <ProtectedRoute module="nomina">
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="employees" element={<Employees />} />
            <Route path="employees/:id" element={<EmployeeProfile />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="history" element={<History />} />
            <Route path="connectors" element={<Connectors />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Placeholder modules — Coming Soon */}
          <Route
            path="/rrhh"
            element={
              <ProtectedRoute module="rrhh">
                <ModuleShell moduleId="rrhh" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/facturacion"
            element={
              <ProtectedRoute module="facturacion">
                <ModuleShell moduleId="facturacion" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gastos"
            element={
              <ProtectedRoute module="gastos">
                <ModuleShell moduleId="gastos" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/it"
            element={
              <ProtectedRoute module="it">
                <ModuleShell moduleId="it" />
              </ProtectedRoute>
            }
          />

          {/* Unknown → Suite home */}
          <Route path="*" element={<Navigate to="/suite" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
