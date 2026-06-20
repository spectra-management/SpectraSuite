/**
 * Nómina payroll constants — public API of the payroll engine.
 *
 * The DR fiscal/payroll defaults live in `@/shared/lib/payroll-defaults` so the
 * shared settings store can seed them without depending on this module. They are
 * re-exported here unchanged, so existing payroll consumers keep importing them
 * from `@/modules/nomina/lib/payroll/constants`.
 */
export {
  DEFAULT_FISCAL_PARAMETERS,
  DEFAULT_PAYROLL_SETTINGS,
  DEFAULT_NIGHT_SHIFT_SETTINGS,
} from '@/shared/lib/payroll-defaults'
