import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { AuthProvider } from '@/shared/context/AuthContext'
import { ProtectedRoute } from '@/shared/components/ProtectedRoute'
import { Layout } from '@/shared/components/layout/Layout'
import { ModuleShell } from '@/shared/components/layout/ModuleShell'
import Login from './pages/Login'
import AccessDenied from '@/shared/components/AccessDenied'
import SuiteHome from '@/suite/pages/SuiteHome'
import SuiteSettings from '@/suite/pages/SuiteSettings'
import SuiteConnectors from '@/suite/pages/SuiteConnectors'
import Dashboard from '@/modules/nomina/pages/Dashboard'
import Employees from '@/modules/nomina/pages/Employees'
import EmployeeProfile from '@/modules/nomina/pages/Employees/EmployeeProfile'
import Payroll from '@/modules/nomina/pages/Payroll'
import History from '@/modules/nomina/pages/History'
import Settings from '@/modules/nomina/pages/Settings'
import { RrhhLayout, Directory, Profile, OrgChart, TimeOff, Departments } from '@/modules/rrhh'
import {
  BillingLayout,
  BillingDashboard,
  Clients,
  ClientDetail,
  Invoices,
  NewInvoice,
  InvoiceDetail,
  BillingReports,
} from '@/modules/facturacion'
import { DocumentosLayout, DocumentosGenerate, DocumentosTemplates, DocumentosHistory } from '@/modules/documentos'

export default function App() {
  return (
    <ErrorBoundary fullScreen>
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
          <Route
            path="/suite/connectors"
            element={
              <ProtectedRoute requireSuperAdmin>
                <SuiteConnectors />
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
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* RRHH module (Human Resources — read-only BambooHR data) */}
          <Route
            path="/rrhh"
            element={
              <ProtectedRoute module="rrhh">
                <RrhhLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="directory" replace />} />
            <Route path="directory" element={<Directory />} />
            <Route path="directory/:id" element={<Profile />} />
            <Route path="org" element={<OrgChart />} />
            <Route path="time-off" element={<TimeOff />} />
            <Route path="departments" element={<Departments />} />
          </Route>

          {/* Facturación module (Billing/Invoicing — reads finalized Payroll data) */}
          <Route
            path="/facturacion"
            element={
              <ProtectedRoute module="facturacion">
                <BillingLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<BillingDashboard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="invoices" element={<Invoices />} />
            <Route
              path="invoices/new"
              element={
                <ProtectedRoute module="facturacion" action="edit">
                  <NewInvoice />
                </ProtectedRoute>
              }
            />
            <Route path="invoices/:id" element={<InvoiceDetail />} />
            <Route path="reports" element={<BillingReports />} />
          </Route>

          {/* Documentos module (company documents — contracts, letters, NDAs) */}
          <Route
            path="/documentos"
            element={
              <ProtectedRoute module="documentos">
                <DocumentosLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="generate" replace />} />
            <Route path="generate" element={<DocumentosGenerate />} />
            <Route path="templates" element={<DocumentosTemplates />} />
            <Route path="history" element={<DocumentosHistory />} />
          </Route>

          {/* Placeholder modules — Coming Soon */}
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
    </ErrorBoundary>
  )
}
