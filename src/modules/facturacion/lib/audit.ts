/**
 * Thin billing-specific wrappers over the shared audit logger. Every wrapper is
 * best-effort and never throws (the underlying RPC swallows errors). Category is
 * always 'facturacion'.
 */

import { logAuditEvent } from '@/shared/lib/audit'

export function auditClientCreated(clientId: string, name: string): void {
  void logAuditEvent({
    action: 'client_created',
    category: 'facturacion',
    resource_type: 'billing_client',
    resource_id: clientId,
    details: { name },
  })
}

export function auditClientUpdated(clientId: string, name: string): void {
  void logAuditEvent({
    action: 'client_updated',
    category: 'facturacion',
    resource_type: 'billing_client',
    resource_id: clientId,
    details: { name },
  })
}

export function auditRateChanged(
  clientId: string,
  scope: 'title' | 'employee',
  ref: string,
  details: Record<string, unknown>,
): void {
  void logAuditEvent({
    action: 'rate_changed',
    category: 'facturacion',
    resource_type: scope === 'title' ? 'billing_title_rate' : 'billing_client_employee',
    resource_id: ref,
    details: { clientId, scope, ...details },
  })
}

export function auditInvoiceGenerated(invoiceId: string, clientId: string, total: number): void {
  void logAuditEvent({
    action: 'invoice_generated',
    category: 'facturacion',
    resource_type: 'billing_invoice',
    resource_id: invoiceId,
    details: { clientId, total },
  })
}

export function auditInvoiceFinalized(invoiceId: string, number: string, total: number): void {
  void logAuditEvent({
    action: 'invoice_finalized',
    category: 'facturacion',
    resource_type: 'billing_invoice',
    resource_id: invoiceId,
    details: { number, total },
  })
}

export function auditBonusAdded(invoiceId: string, label: string, amount: number): void {
  void logAuditEvent({
    action: 'bonus_added',
    category: 'facturacion',
    resource_type: 'billing_invoice',
    resource_id: invoiceId,
    details: { label, amount },
  })
}
