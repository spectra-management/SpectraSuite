import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { ModuleShell } from './components/layout/ModuleShell'
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
      <Routes>
        {/* Default → Spectra Suite home */}
        <Route path="/" element={<Navigate to="/suite" replace />} />
        <Route path="/suite" element={<SuiteHome />} />
        <Route path="/suite/settings" element={<SuiteSettings />} />

        {/* Nómina module (the existing payroll app) */}
        <Route path="/nomina" element={<Layout />}>
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
        <Route path="/rrhh" element={<ModuleShell moduleId="rrhh" />} />
        <Route path="/facturacion" element={<ModuleShell moduleId="facturacion" />} />
        <Route path="/gastos" element={<ModuleShell moduleId="gastos" />} />
        <Route path="/it" element={<ModuleShell moduleId="it" />} />

        {/* Unknown → Suite home */}
        <Route path="*" element={<Navigate to="/suite" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
