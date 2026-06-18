// Paystub label dictionary + language selector, shared by the PDF and the on-screen preview
// so both always match. FEATURE 1: paystub language is driven by the EMPLOYEE'S COUNTRY —
// Dominican Republic & Mexico → Spanish, every other country → English.

export type PaystubLang = 'en' | 'es'

/** Spanish for Dominican Republic & Mexico; English otherwise. */
export function getPaystubLang(country?: string): PaystubLang {
  const c = (country ?? '').toLowerCase().trim()
  if (c.includes('dominican') || c === 'do') return 'es'
  if (c.includes('mexico') || c.includes('méxico') || c === 'mx') return 'es'
  return 'en'
}

export interface PaystubLabels {
  stub: string
  dateRange: string
  payDate: string
  employeeName: string
  position: string
  dept: string
  empId: string
  paymentMethod: string
  earnings: string
  payDesc: string
  hours: string
  rate: string
  rateCol: string
  total: string
  regular: string
  night: string
  holiday: string
  ot: string
  grossTotal: string
  deductions: string
  sfs: string
  afp: string
  payAdvance: string
  dependentTSS: string
  isr: string
  vacationIsr: string
  isrTotalRetained: string
  isrSalary: string
  complementaryIns: string
  totalDed: string
  netPay: string
  rnc: string
  generatedOn: string
}

export const PAYSTUB_LABELS: Record<PaystubLang, PaystubLabels> = {
  en: {
    stub: 'PAYSTUB',
    dateRange: 'Date Range',
    payDate: 'Pay Date',
    employeeName: 'Employee Name',
    position: 'Position',
    dept: 'Department',
    empId: 'ID',
    paymentMethod: 'Payment Method',
    earnings: 'EARNINGS',
    payDesc: 'PAYMENT DESCRIPTION',
    hours: 'HOURS',
    rate: 'RATE',
    rateCol: 'RATE',
    total: 'TOTAL',
    regular: 'Regular Hours',
    night: 'Night Incentive',
    holiday: 'Double Holiday Hours',
    ot: 'Overtime Hours',
    grossTotal: 'GROSS TOTAL',
    deductions: 'DEDUCTIONS',
    sfs: 'Family Health Insurance (SFS)',
    afp: 'Pension Retention (AFP)',
    payAdvance: 'Pay Advance Deduction',
    dependentTSS: 'Dependent TSS Retention',
    isr: 'Tax Retention ISR (DGII)',
    vacationIsr: 'Vacation ISR',
    isrTotalRetained: 'Total ISR Retained',
    isrSalary: 'Salary for the month applicable to ISR',
    complementaryIns: 'Complementary Insurance Dependent',
    totalDed: 'Total Deductions',
    netPay: 'NET INCOME',
    rnc: 'RNC',
    generatedOn: 'Generated on',
  },
  es: {
    stub: 'RECIBO DE PAGO',
    dateRange: 'Período',
    payDate: 'Fecha de Pago',
    employeeName: 'Nombre del Empleado',
    position: 'Cargo',
    dept: 'Departamento',
    empId: 'ID',
    paymentMethod: 'Método de Pago',
    earnings: 'INGRESOS',
    payDesc: 'DESCRIPCIÓN',
    hours: 'HORAS',
    rate: 'TASA',
    rateCol: 'TASA',
    total: 'TOTAL',
    regular: 'Horas Regulares',
    night: 'Incentivo Nocturno',
    holiday: 'Horas Feriado Doble',
    ot: 'Horas Extra',
    grossTotal: 'TOTAL BRUTO',
    deductions: 'DEDUCCIONES',
    sfs: 'Seguro Familiar de Salud (SFS)',
    afp: 'Retención Pensión (AFP)',
    payAdvance: 'Deducción Adelanto de Salario',
    dependentTSS: 'Retención TSS Dependientes',
    isr: 'Retención ISR (DGII)',
    vacationIsr: 'ISR Vacaciones',
    isrTotalRetained: 'Total ISR Retenido',
    isrSalary: 'Salario del mes aplicable al ISR',
    complementaryIns: 'Seguro Complementario Dependiente',
    totalDed: 'Total Deducciones',
    netPay: 'INGRESO NETO',
    rnc: 'RNC',
    generatedOn: 'Generado el',
  },
}

// US statutory deduction names override the DR-style SFS/AFP/ISR labels (US is English).
export const US_DEDUCTION_LABELS = {
  sfs: 'Medicare (1.45%)',
  afp: 'Social Security (6.2%)',
  isr: 'Federal Income Tax',
}

// Display labels for each payment method, by paystub language.
export const PAYMENT_METHOD_LABELS: Record<PaystubLang, Record<'cash' | 'transfer' | 'check', string>> = {
  en: { cash: 'Cash', transfer: 'Bank Transfer', check: 'Check' },
  es: { cash: 'Efectivo', transfer: 'Transferencia', check: 'Cheque' },
}
