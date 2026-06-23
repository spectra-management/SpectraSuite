/**
 * Billing (facturación) access gate.
 *
 * Reuses the Suite-wide RBAC (`useAuth().hasModuleAccess`) — no parallel permission
 * system. Chosen checks (documented in BILLING_PROGRESS.md):
 *
 *   - canView   → hasModuleAccess('facturacion', 'view')
 *       See clients, assignments, invoices, the on-screen billing report, dashboard.
 *   - canEdit   → hasModuleAccess('facturacion', 'edit')   (requires view + edit)
 *       Create/edit clients, title rates, per-employee overrides, assignments;
 *       generate, edit and finalize invoices; add bonus lines.
 *   - canViewFinancials → hasModuleAccess('facturacion', 'admin')   (STRONGER)
 *       Reading employee PAY (the 'percentage' billing method multiplies a rate by
 *       finalized payroll pay) and the financial reports that expose revenue/margins.
 *       This is sensitive cross-employee compensation data, so it sits behind the
 *       strongest available action. super_admin / legacy module_admin bypass, as
 *       elsewhere. Relax to 'approve' if 'admin' proves too strict.
 */

import { useAuth } from '@/shared/context/AuthContext'

export interface BillingAccess {
  canView: boolean
  canEdit: boolean
  /** Gate for the percentage method's pay readout + financial reports. */
  canViewFinancials: boolean
}

export function useBillingAccess(): BillingAccess {
  const { hasModuleAccess } = useAuth()
  return {
    canView: hasModuleAccess('facturacion', 'view'),
    canEdit: hasModuleAccess('facturacion', 'edit'),
    canViewFinancials: hasModuleAccess('facturacion', 'admin'),
  }
}
