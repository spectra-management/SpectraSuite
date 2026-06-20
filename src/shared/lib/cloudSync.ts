// ============================================================================
// Cloud sync layer (Part 7) — mirrors selected localStorage data to Supabase.
//
// Design principle: localStorage stays the source of truth / offline cache.
// Cloud reads/writes are BEST-EFFORT and never throw — if Supabase is
// unreachable or the user lacks RLS permission, we silently fall back to
// localStorage so existing Nómina flows keep working unchanged.
// ============================================================================
import { supabase, isSupabaseConfigured } from '@/shared/lib/supabase'
import type { CompanySettings, BambooHRConfig, HubstaffConfig } from '@/shared/types'

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
