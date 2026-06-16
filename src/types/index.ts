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
}

export interface PayrollPeriod {
  id: string
  startDate: string
  endDate: string
  frequency: 'biweekly' | 'weekly'
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
  taxableIncome: number
  isrMonthly: number
  isrCalculated: number  // ISR for this period (before quincena override)
  isrPeriod: number      // ISR actually retained (0 for 1st quincena)
  customDeductions: number
  customDeductionsBreakdown: Array<{ name: string; amount: number }>
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
  accentColor: string
}

export interface PayrollSettings {
  frequency: 'biweekly' | 'weekly'
  otThresholdHours: number
  otRatePercent: number
  holidayRatePercent: number
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
