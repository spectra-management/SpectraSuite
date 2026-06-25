// Hand-written Supabase schema types mirroring supabase/migrations/001_initial_schema.sql.
// Kept intentionally small (Row/Insert/Update per table) so queries are type-checked
// without pulling the full generated types file.

export type UserRole = 'super_admin' | 'module_admin' | 'viewer' | 'custom'
export type ModuleId = 'nomina' | 'rrhh' | 'facturacion' | 'gastos' | 'it' | 'documentos'

export interface ProfileRow {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ModulePermissionRow {
  id: string
  user_id: string
  module: ModuleId
  can_view: boolean
  can_edit: boolean
  can_approve: boolean
  can_admin: boolean
  created_at: string
}

export interface CompanySettingsRow {
  id: string
  company_name: string | null
  rnc: string | null
  address: string | null
  phone: string | null
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  session_timeout_minutes: number | null
  created_at: string
  updated_at: string
}

export type AuditCategory = 'auth' | 'user_management' | 'payroll' | 'vacation' | 'settings' | 'connector' | 'facturacion' | 'documentos'

export interface AuditLogRow {
  id: string
  user_id: string | null
  user_email: string | null
  action: string
  category: AuditCategory
  resource_type: string | null
  resource_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  status: 'success' | 'failure'
  error_message: string | null
  created_at: string
}

export interface IntegrationRow {
  id: string
  name: 'bamboohr' | 'hubstaff' | 'resend'
  credentials: Record<string, unknown>
  is_active: boolean
  last_tested_at: string | null
  created_at: string
  updated_at: string
}

export interface VacationPaymentRow {
  id: string
  bamboohr_employee_id: string
  employee_name: string
  year: number
  entitled_days: number
  daily_salary: number | null
  gross_amount: number | null
  sfs_amount: number | null
  afp_amount: number | null
  isr_amount: number | null
  net_amount: number | null
  isr_applied_in_period: string | null
  vacation_start: string | null
  vacation_end: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

// Shape must satisfy supabase-js's GenericTable (needs Relationships) so the
// typed client resolves Row/Insert/Update instead of falling back to `never`.
export interface RoleRow {
  id: string
  name: string
  description: string | null
  is_system: boolean
  is_editable: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RolePermissionRow {
  id: string
  role_id: string
  module: ModuleId
  can_view: boolean
  can_edit: boolean
  can_approve: boolean
  can_admin: boolean
}

export interface UserRoleRow {
  id: string
  user_id: string
  role_id: string
  assigned_by: string | null
  assigned_at: string
}

/** Aggregated module permission (any role granting it wins). */
export interface ModulePerm {
  can_view: boolean
  can_edit: boolean
  can_approve: boolean
  can_admin: boolean
}
export type PermAction = 'view' | 'edit' | 'approve' | 'admin'

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow>
      user_module_permissions: Table<ModulePermissionRow>
      company_settings: Table<CompanySettingsRow>
      integrations: Table<IntegrationRow>
      vacation_payments: Table<VacationPaymentRow>
      audit_log: Table<AuditLogRow>
      roles: Table<RoleRow>
      role_permissions: Table<RolePermissionRow>
      user_roles: Table<UserRoleRow>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
