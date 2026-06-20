import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/shared/context/AuthContext'
import { ProtectedRoute } from '@/shared/components/ProtectedRoute'
import { Layout } from '@/shared/components/layout/Layout'
import { ModuleShell } from '@/shared/components/layout/ModuleShell'
import Login from './pages/Login'
import AccessDenied from '@/shared/components/AccessDenied'
import SuiteHome from '@/suite/pages/SuiteHome'
import SuiteSettings from '@/suite/pages/SuiteSettings'
import Dashboard from '@/modules/nomina/pages/Dashboard'
import Employees from '@/modules/nomina/pages/Employees'
import EmployeeProfile from '@/modules/nomina/pages/Employees/EmployeeProfile'
import Payroll from '@/modules/nomina/pages/Payroll'
import History from '@/modules/nomina/pages/History'
import Connectors from '@/modules/nomina/pages/Connectors'
import Settings from '@/modules/nomina/pages/Settings'

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
            <Route
              path="payroll"
              element={
                <ProtectedRoute module="nomina" action="edit">
                  <Payroll />
                </ProtectedRoute>
              }
            />
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
