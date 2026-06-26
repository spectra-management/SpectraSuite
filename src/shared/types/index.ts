export type PaymentMethod = 'cash' | 'transfer' | 'check'

export interface BankAccount {
  bank: string
  accountNumber: string
}

export interface Employee {
  id: string
  firstName: string
  lastName: string
  workEmail: string
  payRate: number
  payRateCurrency?: string   // '' = not set in BambooHR; undefined = legacy pre-currency-sync
  payType: 'Hourly' | 'Salary'
  jobTitle: string
  department: string
  hireDate: string
  status: 'Active' | 'Inactive' | 'Terminated'
  hubstaffUserId?: string
  customDeductions?: CustomDeduction[]
  country?: string
  /**
   * Spectra-local payroll inclusion flag (NOT the BambooHR `status` above).
   * Permanent across payroll runs. `false` = excluded from payroll calculation,
   * Review Hours totals, paystubs and reports (employee still appears in the
   * employee list). Defaults to active; treat a missing value as active
   * (compare with `=== false`). Preserved across BambooHR re-sync.
   */
  payroll_active: boolean
}

export interface CustomDeduction {
  id: string
  name: string
  type: 'fixed' | 'percentage'
  amount: number
  recurring: boolean
  active: boolean
}

export interface HubstaffUser {
  id: string
  name: string
  email: string
}

export interface EmployeeHoursEntry {
  employeeId: string
  hubstaffUserId?: string
  regularHours: number
  otHours: number
  holidayHours: number
  source: 'hubstaff' | 'manual'
  editedManually?: boolean
  /** Admin-entered hourly rate, used when the employee's BambooHR pay rate is "Not set". */
  payRateOverride?: number
  /** Manually-entered nocturnal hours for the period (Hubstaff daily totals lack time-of-day). */
  nightHours?: number
}

export interface PayrollPeriod {
  id: string
  startDate: string
  endDate: string
  frequency: 'biweekly' | 'weekly' | 'full_month'
  status: 'draft' | 'approved' | 'sent'
  processedDate?: string
  entries: PayrollEntry[]
  totals: PayrollTotals
  country?: string
}

export interface PayrollEntry {
  employee: Employee
  hours: EmployeeHoursEntry
  calculation: PayrollCalculation
}

export interface PayrollCalculation {
  regularPay: number
  otPay: number
  holidayPay: number
  grossPay: number
  afpBase: number
  afpAmount: number
  sfsBase: number
  sfsAmount: number
  tssTotal: number
  /** Per-country statutory deduction breakdown (optional for runs saved before this existed). */
  deductionsBreakdown?: Array<{ id: string; name: string; rate: number; base: number; amount: number }>
  taxableIncome: number
  isrMonthlyBase: number // monthly net base the ISR scale is applied to (net 1st + net 2nd fortnight)
  isrMonthly: number
  isrCalculated: number  // ISR computed for the period (kept for compatibility)
  isrPeriod: number      // ISR actually retained (0 for 1st quincena, full month's ISR on 2nd)
  isrDeferred: boolean   // true only on DR 1st quincena (ISR deferred to 2nd fortnight)
  customDeductions: number
  customDeductionsBreakdown: Array<{ name: string; amount: number }>
  nightIncentiveHours: number  // hours the 15% nocturnal incentive applies to
  nightIncentiveAmount: number // nightIncentiveHours × rate × 0.15 (additive to gross)
  vacationIsr: number          // pending vacation ISR collected this period (2nd fortnight)
  totalDeductions: number
  netPay: number
}

export interface PayrollTotals {
  totalGross: number
  totalAfp: number
  totalSfs: number
  totalTss: number
  totalIsr: number
  totalCustomDeductions: number
  totalDeductions: number
  totalNet: number
  employeeCount: number
}

export interface CompanySettings {
  name: string
  rnc: string
  address: string
  phone: string
  email: string
  logoBase64?: string
  accentColor: string       // brand primary color
  secondaryColor?: string   // brand secondary color
}

export interface PayrollSettings {
  frequency: 'biweekly' | 'weekly' | 'full_month'
  otThresholdHours: number
  otRatePercent: number
  holidayRatePercent: number
}

export interface NightShiftSettings {
  /** When night shift begins, "HH:MM" (default "21:00"). Morning end is fixed at 07:00. */
  nightStartTime: string
  /** How a mixed shift becomes treated as fully nocturnal. */
  mixedThresholdMode: 'percent' | 'hours'
  /** Hours threshold X for 'hours' mode (default 3.5). Ignored in 'percent' mode (>50%). */
  mixedThresholdHours: number
}

export interface FiscalParameters {
  minCotizableSalary: number
  afpRate: number
  sfsRate: number
  afpCapMultiplier: number
  sfsCapMultiplier: number
  dailyDivisor: number
  isrBrackets: ISRBracket[]
}

export interface ISRBracket {
  minAmount: number
  maxAmount: number | null
  rate: number
  fixedAmount: number
}

/**
 * A single employee statutory deduction in a country's fiscal config (e.g. NIS, SSS,
 * PhilHealth, Housing Levy). Withheld BEFORE income tax. Either a percentage of the
 * (optionally capped) base, or a flat per-period amount.
 */
export interface CountryDeduction {
  /** Stable id; 'afp'/'sfs' map to the legacy pension/health slots for back-compat. */
  id: string
  /** Display name shown on the paystub — tax names aren't translated (e.g. "NIS", "SSS"). */
  name: string
  /** Percent of the base. Ignored when fixedAmount is set. */
  rate: number
  /** Max base per pay period the rate applies to; null = no cap. */
  capBase: number | null
  /** Flat per-period amount instead of rate × base (e.g. T&T Health Surcharge). */
  fixedAmount?: number
  /** When false, the deduction is NOT withheld (toggle per country in settings). */
  enabled: boolean
}

/**
 * Per-country fiscal rules (employee deductions + income tax). Editable in Nómina settings,
 * stored/merged over researched defaults. The Dominican Republic keeps its dedicated
 * FiscalParameters path (quincena ISR + legal paystub); this drives every OTHER country.
 */
export interface CountryFiscalConfig {
  /** Canonical country display name (matches the employee country string). */
  country: string
  currency: string
  currencySymbol: string
  dailyDivisor: number
  /** Employee statutory contributions, withheld before income tax. */
  deductions: CountryDeduction[]
  /** Income-tax label (ISR / PAYE / Withholding Tax / Federal Income Tax). */
  incomeTaxName: string
  /** Annual income-tax brackets (same engine as the DR DGII scale). */
  incomeTaxBrackets: ISRBracket[]
}

export interface BambooHRConfig {
  subdomain: string
  apiKey: string
  connected: boolean
  lastSync?: string
}

export interface HubstaffConfig {
  refreshToken: string
  organizationId: string
  connected: boolean
  lastSync?: string
  employeeMapping: HubstaffMapping[]
  cachedAccessToken?: string
  cachedAccessTokenExpiry?: number  // Unix ms — used to skip exchange when token is still valid
}

export interface HubstaffMapping {
  hubstaffUserId: string
  bambooEmployeeId: string
  autoMatched: boolean
}

export interface EmailConfig {
  provider: 'resend' | 'smtp'
  fromName: string
  fromEmail: string
  resendApiKey?: string
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPassword?: string
  connected: boolean
}

export interface EmailTemplate {
  subject: string
  body: string
  payStubLanguage: 'en' | 'es'
}

export interface AppSettings {
  company: CompanySettings
  payroll: PayrollSettings
  nightShift: NightShiftSettings
  fiscal: FiscalParameters
  bamboohr: BambooHRConfig
  hubstaff: HubstaffConfig
  email: EmailConfig
  emailTemplate: EmailTemplate
}

export interface SendResult {
  employeeId: string
  success: boolean
  error?: string
}
