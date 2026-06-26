/**
 * Default fiscal/payroll configuration (Dominican Republic).
 *
 * Kept in `shared` so the shared settings store can seed its defaults without
 * depending on the nómina module (which would invert the shared → module
 * boundary). The nómina payroll engine re-exports these from
 * `@/modules/nomina/lib/payroll/constants`, so payroll consumers are unaffected.
 *
 * These values are CONFIGURABLE at runtime via Settings → Fiscal Parameters
 * (DGII may update the ISR scale, minimum cotizable salary, etc.).
 */
import type { FiscalParameters, PayrollSettings, NightShiftSettings } from '@/shared/types'

export const DEFAULT_FISCAL_PARAMETERS: FiscalParameters = {
  minCotizableSalary: 16341.60,
  afpRate: 2.87,
  sfsRate: 3.04,
  afpCapMultiplier: 20,
  sfsCapMultiplier: 10,
  dailyDivisor: 23.83,
  isrBrackets: [
    { minAmount: 0, maxAmount: 416220.00, rate: 0, fixedAmount: 0 },
    { minAmount: 416220.01, maxAmount: 624329.00, rate: 15, fixedAmount: 0 },
    { minAmount: 624329.01, maxAmount: 867123.00, rate: 20, fixedAmount: 31216.35 },
    { minAmount: 867123.01, maxAmount: null, rate: 25, fixedAmount: 79776.35 },
  ],
}

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  frequency: 'biweekly',
  otThresholdHours: 40,
  // OT differential: +50% on top of the base rate (base hours are paid at 100% in regular pay).
  otRatePercent: 50,
  holidayRatePercent: 100,
}

export const DEFAULT_NIGHT_SHIFT_SETTINGS: NightShiftSettings = {
  nightStartTime: '21:00',          // night shift begins 9pm; morning end fixed at 07:00
  mixedThresholdMode: 'percent',    // mixed shift → fully nocturnal when >50% of hours are night
  mixedThresholdHours: 3.5,         // X for 'hours' mode
}
