// ============================================================================
// Cloud sync layer (Part 7) — mirrors selected localStorage data to Supabase.
//
// Design principle: localStorage stays the source of truth / offline cache.
// Cloud reads/writes are BEST-EFFORT and never throw — if Supabase is
// unreachable or the user lacks RLS permission, we silently fall back to
// localStorage so existing Nómina flows keep working unchanged.
// ============================================================================
import { supabase, isSupabaseConfigured } from '@/shared/lib/supabase'
import type { CompanySettings, BambooHRConfig, HubstaffConfig, PayrollPeriod } from '@/shared/types'
import type { CloudEmployee } from '@/shared/connectors/bamboohr-hr'

async function isAuthenticated(): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

// ─── Company settings ────────────────────────────────────────────────────────

/** Fetch company settings from Supabase, or null if unavailable. */
export async function fetchCompanySettings(): Promise<Partial<CompanySettings> | null> {
  if (!(await isAuthenticated())) return null
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return {
      name: data.company_name ?? undefined,
      rnc: data.rnc ?? undefined,
      address: data.address ?? undefined,
      phone: data.phone ?? undefined,
      logoBase64: data.logo_url ?? undefined,
      accentColor: data.primary_color ?? undefined,
      secondaryColor: data.secondary_color ?? undefined,
    } as Partial<CompanySettings>
  } catch (e) {
    console.warn('[cloudSync] fetchCompanySettings failed:', e)
    return null
  }
}

/** Upsert company settings to Supabase (single-row table). Best-effort. */
export async function saveCompanySettings(company: CompanySettings): Promise<void> {
  if (!(await isAuthenticated())) return
  try {
    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .maybeSingle()
    const payload = {
      company_name: company.name,
      rnc: company.rnc,
      address: company.address,
      phone: company.phone,
      logo_url: company.logoBase64 ?? null,
      primary_color: company.accentColor,
      secondary_color: company.secondaryColor ?? null,
      updated_at: new Date().toISOString(),
    }
    if (existing?.id) {
      await supabase.from('company_settings').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('company_settings').insert(payload)
    }
  } catch (e) {
    console.warn('[cloudSync] saveCompanySettings failed:', e)
  }
}

// ─── Integrations (BambooHR / Hubstaff credentials) ──────────────────────────

type IntegrationName = 'bamboohr' | 'hubstaff' | 'resend'

async function upsertIntegration(
  name: IntegrationName,
  credentials: Record<string, unknown>,
  isActive: boolean,
): Promise<void> {
  if (!(await isAuthenticated())) return
  try {
    const { data: existing } = await supabase
      .from('integrations')
      .select('id')
      .eq('name', name)
      .limit(1)
      .maybeSingle()
    const payload = {
      name,
      credentials,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    }
    if (existing?.id) {
      await supabase.from('integrations').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('integrations').insert(payload)
    }
  } catch (e) {
    console.warn(`[cloudSync] upsertIntegration(${name}) failed:`, e)
  }
}

export function saveBambooIntegration(cfg: BambooHRConfig): Promise<void> {
  return upsertIntegration('bamboohr', { subdomain: cfg.subdomain, apiKey: cfg.apiKey }, cfg.connected)
}

export function saveHubstaffIntegration(cfg: HubstaffConfig): Promise<void> {
  return upsertIntegration('hubstaff', { refreshToken: cfg.refreshToken, orgId: cfg.organizationId }, cfg.connected)
}

/** Fetch stored integration credentials by name, or null. */
export async function fetchIntegration(
  name: IntegrationName,
): Promise<Record<string, unknown> | null> {
  if (!(await isAuthenticated())) return null
  try {
    const { data, error } = await supabase
      .from('integrations')
      .select('credentials, is_active')
      .eq('name', name)
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return { ...(data.credentials ?? {}), is_active: data.is_active }
  } catch (e) {
    console.warn(`[cloudSync] fetchIntegration(${name}) failed:`, e)
    return null
  }
}

/**
 * Read back BOTH connector credential rows in one shot (used to hydrate the settings
 * store on login so connections survive deploys/new devices). Either may be null.
 */
export async function fetchConnectorConfigs(): Promise<{
  bamboohr: Record<string, unknown> | null
  hubstaff: Record<string, unknown> | null
}> {
  const [bamboohr, hubstaff] = await Promise.all([
    fetchIntegration('bamboohr'),
    fetchIntegration('hubstaff'),
  ])
  return { bamboohr, hubstaff }
}

// ─── Payroll runs (cloud-authoritative; data JSONB column, see migration 010) ────

/**
 * Upsert one payroll run to `payroll_runs`. The canonical run object is stored in the
 * `data` JSONB column (full fidelity — entries/totals round-trip); the structured
 * summary columns are mirrored for queryability. Conflict target is `local_id` (the
 * app's non-UUID id). Best-effort: writes require nomina/super admin RLS and no-op
 * otherwise; a missing `data`/`local_id` column (migration 010 not yet run) is caught.
 */
export async function savePayrollRunCloud(run: PayrollPeriod): Promise<void> {
  if (!(await isAuthenticated())) return
  try {
    const row = {
      local_id: run.id,
      period_start: run.startDate,
      period_end: run.endDate,
      pay_date: run.processedDate ?? null,
      country: run.country ?? 'Dominican Republic',
      frequency: run.frequency,
      status: run.status,
      total_gross: run.totals?.totalGross ?? null,
      total_deductions: run.totals?.totalDeductions ?? null,
      total_net: run.totals?.totalNet ?? null,
      employee_count: run.totals?.employeeCount ?? null,
      data: run,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('payroll_runs').upsert(row, { onConflict: 'local_id' })
  } catch (e) {
    console.warn('[cloudSync] savePayrollRunCloud failed:', e)
  }
}

/** Fetch all payroll runs from the cloud (reconstructed from the `data` column). */
export async function fetchPayrollRunsCloud(): Promise<PayrollPeriod[]> {
  if (!(await isAuthenticated())) return []
  try {
    const { data, error } = await supabase
      .from('payroll_runs')
      .select('data')
      .not('data', 'is', null)
    if (error || !data) return []
    return (data as Array<{ data: PayrollPeriod | null }>)
      .map((r) => r.data)
      .filter((d): d is PayrollPeriod => !!d && !!d.id)
  } catch (e) {
    console.warn('[cloudSync] fetchPayrollRunsCloud failed:', e)
    return []
  }
}

// ─── Generic app_state KV (durable mirror for store blobs; see migration 010) ────
//
// Used for store shapes that have no faithful relational home (the nested vacation
// maps). The localStorage blob is mirrored verbatim to a single JSONB row keyed by
// the store's localStorage key, so it round-trips losslessly.

/** Upsert a JSON blob into `app_state` under `key`. Best-effort. */
export async function saveAppState(key: string, value: unknown): Promise<void> {
  if (!(await isAuthenticated())) return
  try {
    await supabase
      .from('app_state')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  } catch (e) {
    console.warn(`[cloudSync] saveAppState(${key}) failed:`, e)
  }
}

/** Read a JSON blob from `app_state`, or null if absent/unavailable. */
export async function fetchAppState<T>(key: string): Promise<T | null> {
  if (!(await isAuthenticated())) return null
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('value')
      .eq('key', key)
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return (data.value ?? null) as T | null
  } catch (e) {
    console.warn(`[cloudSync] fetchAppState(${key}) failed:`, e)
    return null
  }
}

// ─── Employees (durable HR detail; see migration 012) ────────────────────────
//
// The cloud copy of the employee directory + rich HR fields (cédula, address, phone,
// DOB…). Lets the Documentos module fill documents from the database regardless of
// whether BambooHR is currently connected. RLS gates the sensitive fields to admins /
// RRHH / Documentos access (writes require an admin). Best-effort like the rest.

interface EmployeeRow {
  bamboohr_id: string
  first_name: string
  last_name: string
  work_email: string
  job_title: string
  department: string
  hire_date: string
  status: string
  country: string
  pay_rate: number
  pay_rate_currency: string
  pay_type: string
  national_id: string
  address: string
  city: string
  state: string
  zipcode: string
  mobile_phone: string
  work_phone: string
  home_phone: string
  date_of_birth: string
  gender: string
  marital_status: string
  nationality: string
  supervisor: string
  employee_number: string
}

function toRow(e: CloudEmployee): EmployeeRow {
  return {
    bamboohr_id: e.id,
    first_name: e.firstName,
    last_name: e.lastName,
    work_email: e.workEmail,
    job_title: e.jobTitle,
    department: e.department,
    hire_date: e.hireDate,
    status: e.status,
    country: e.country,
    pay_rate: e.payRate,
    pay_rate_currency: e.payRateCurrency,
    pay_type: e.payType,
    national_id: e.nationalId,
    address: e.address,
    city: e.city,
    state: e.state,
    zipcode: e.zipcode,
    mobile_phone: e.mobilePhone,
    work_phone: e.workPhone,
    home_phone: e.homePhone,
    date_of_birth: e.dateOfBirth,
    gender: e.gender,
    marital_status: e.maritalStatus,
    nationality: e.nationality,
    supervisor: e.supervisor,
    employee_number: e.employeeNumber,
  }
}

function fromRow(r: EmployeeRow): CloudEmployee {
  return {
    id: r.bamboohr_id,
    firstName: r.first_name ?? '',
    lastName: r.last_name ?? '',
    workEmail: r.work_email ?? '',
    jobTitle: r.job_title ?? '',
    department: r.department ?? '',
    hireDate: r.hire_date ?? '',
    status: r.status ?? '',
    country: r.country ?? '',
    payRate: Number(r.pay_rate ?? 0),
    payRateCurrency: r.pay_rate_currency ?? '',
    payType: r.pay_type === 'Hourly' ? 'Hourly' : 'Salary',
    nationalId: r.national_id ?? '',
    address: r.address ?? '',
    city: r.city ?? '',
    state: r.state ?? '',
    zipcode: r.zipcode ?? '',
    mobilePhone: r.mobile_phone ?? '',
    workPhone: r.work_phone ?? '',
    homePhone: r.home_phone ?? '',
    dateOfBirth: r.date_of_birth ?? '',
    gender: r.gender ?? '',
    maritalStatus: r.marital_status ?? '',
    nationality: r.nationality ?? '',
    supervisor: r.supervisor ?? '',
    employeeNumber: r.employee_number ?? '',
  }
}

/** Upsert the full employee directory (base + rich HR) to the cloud. Best-effort. */
export async function saveEmployeesCloud(employees: CloudEmployee[]): Promise<void> {
  if (employees.length === 0) return
  if (!(await isAuthenticated())) return
  try {
    const rows = employees.map((e) => ({ ...toRow(e), updated_at: new Date().toISOString() }))
    await supabase.from('employees').upsert(rows, { onConflict: 'bamboohr_id' })
  } catch (e) {
    console.warn('[cloudSync] saveEmployeesCloud failed:', e)
  }
}

/** Read the employee directory back from the cloud. Empty if unavailable / not permitted. */
export async function fetchEmployeesCloud(): Promise<CloudEmployee[]> {
  if (!(await isAuthenticated())) return []
  try {
    const { data, error } = await supabase.from('employees').select('*')
    if (error || !data) return []
    return (data as EmployeeRow[]).filter((r) => !!r.bamboohr_id).map(fromRow)
  } catch (e) {
    console.warn('[cloudSync] fetchEmployeesCloud failed:', e)
    return []
  }
}

// ─── Vacation payments ───────────────────────────────────────────────────────

export interface CloudVacationPayment {
  bamboohr_employee_id: string
  employee_name: string
  year: number
  entitled_days: number
  daily_salary?: number
  gross_amount?: number
  sfs_amount?: number
  afp_amount?: number
  isr_amount?: number
  net_amount?: number
  isr_applied_in_period?: string
}

/** Insert a vacation payment record. Best-effort. */
export async function saveVacationPayment(p: CloudVacationPayment): Promise<void> {
  if (!(await isAuthenticated())) return
  try {
    await supabase.from('vacation_payments').insert({
      bamboohr_employee_id: p.bamboohr_employee_id,
      employee_name: p.employee_name,
      year: p.year,
      entitled_days: p.entitled_days,
      daily_salary: p.daily_salary ?? null,
      gross_amount: p.gross_amount ?? null,
      sfs_amount: p.sfs_amount ?? null,
      afp_amount: p.afp_amount ?? null,
      isr_amount: p.isr_amount ?? null,
      net_amount: p.net_amount ?? null,
      isr_applied_in_period: p.isr_applied_in_period ?? null,
    })
  } catch (e) {
    console.warn('[cloudSync] saveVacationPayment failed:', e)
  }
}
