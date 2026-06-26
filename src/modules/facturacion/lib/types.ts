/**
 * Billing (facturación) domain types.
 *
 * The module bills clients for staff labor using the hours that Payroll FINALIZED
 * (read via `@/shared/lib/payrollData`). Rate resolution priority:
 *   1. TITLE RATE (base) — per client, a rate per job title.
 *   2. PER-EMPLOYEE OVERRIDE — wins over the title rate when set.
 * Billing method (default per client, overridable per employee):
 *   - 'hour'       → rate × verified hours (Base Pay + Overtime as separate lines)
 *   - 'fixed'      → a flat amount per employee
 *   - 'percentage' → rate% × employee pay (pay read from finalized Payroll)
 */

export type BillingMethod = 'hour' | 'fixed' | 'percentage'

/** A client we invoice. */
export interface BillingClient {
  id: string
  name: string
  /** The BambooHR "division" this client was created from (auto clients). Used to match the
   *  employees that belong to this client. Empty for manually-created clients. */
  division?: string
  contactName: string
  contactEmail: string
  contactPhone: string
  /** Where the client is billed (their address). */
  billingAddress: string
  /** "Remit to" — who/where the client should send payment (our remittance block). */
  remitToName: string
  remitToAddress: string
  /** Free-text remittance details (bank, account, payment instructions). */
  remitToDetails: string
  /** Invoice-number prefix, e.g. "RM". */
  invoicePrefix: string
  /** Next sequence number to assign for this client's invoices (starts at 1). */
  nextInvoiceSeq: number
  /** Default billing method for assigned employees (override per employee). */
  defaultMethod: BillingMethod
  /** Single currency for this client's invoices (country name, e.g. "Dominican Republic"). */
  currencyCountry: string
  notes: string
  active: boolean
  createdAt: string
  updatedAt: string
}

/** A base rate per job title, scoped to a client. */
export interface TitleRate {
  id: string
  clientId: string
  /** Job title exactly as it appears on the employee roster. */
  title: string
  /** Base pay rate (per hour for 'hour' method). */
  baseRate: number
  /** Overtime / differential rate (per hour). */
  otRate: number
  createdAt: string
  updatedAt: string
}

/**
 * An employee assigned to a client. Optional fields override the client default /
 * title rate. `null`/`undefined` means "inherit".
 */
export interface ClientEmployee {
  id: string
  clientId: string
  /** Spectra/BambooHR employee id (the roster key). */
  employeeId: string
  /** Override the client's default billing method for this employee. */
  method: BillingMethod | null
  /** Override the title base rate for this employee ('hour' method). */
  baseRateOverride: number | null
  /** Override the title overtime rate for this employee ('hour' method). */
  otRateOverride: number | null
  /** Flat amount per period ('fixed' method). */
  fixedAmount: number | null
  /** Percentage of employee pay, e.g. 15 = 15% ('percentage' method). */
  percentageRate: number | null
  active: boolean
  /** True when auto-created from the employee's BambooHR division (vs a manual assignment). */
  auto?: boolean
  createdAt: string
  updatedAt: string
}

export type InvoiceLineType = 'base' | 'overtime' | 'fixed' | 'percentage' | 'bonus'

/** One line on an invoice. Base Pay and Overtime are SEPARATE line items. */
export interface InvoiceLineItem {
  id: string
  employeeId: string
  /** Snapshot so finalized invoices stay readable even if the roster changes. */
  employeeName: string
  title: string
  type: InvoiceLineType
  /** Display label, e.g. "Base Pay", "Overtime Differential", or a bonus label. */
  label: string
  /** Hours (base/overtime) or quantity (fixed/percentage/bonus, default 1). */
  quantity: number
  /** Rate per unit (hourly rate, fixed amount, or percentage value). */
  rate: number
  /** Computed line amount. */
  amount: number
  /** Bonus lines are manual; everything else is derived from Payroll. */
  manual: boolean
}

export type InvoiceStatus = 'draft' | 'finalized'

export interface Invoice {
  id: string
  clientId: string
  /** Assigned only when finalized, e.g. "RM-0001". Empty while draft. */
  number: string
  status: InvoiceStatus
  /** Billing period covered (drives which finalized runs are pulled). */
  periodStart: string
  periodEnd: string
  /** Source finalized payroll run ids included in this invoice. */
  payrollRunIds: string[]
  lineItems: InvoiceLineItem[]
  subtotal: number
  total: number
  currencyCountry: string
  notes: string
  issueDate: string
  createdAt: string
  updatedAt: string
  finalizedAt: string | null
  createdBy: string | null
  /** Snapshot of client identity at finalize time (so PDFs are stable). */
  clientNameSnapshot: string
}

/** Remembered bonus labels for autocomplete suggestions (nice-to-have). */
export interface BillingMeta {
  bonusLabels: string[]
}
