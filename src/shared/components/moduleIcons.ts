import { Banknote, Users, ReceiptText, FileText, Kanban, CreditCard, Laptop, type LucideIcon } from 'lucide-react'
import type { SuiteModuleId } from '@/shared/lib/suiteModules'

// Lucide icon per Suite module — replaces emoji so the brand reads as a single,
// intentional icon system (lucide-only, per the design system).
export const MODULE_ICONS: Record<SuiteModuleId, LucideIcon> = {
  nomina: Banknote,
  rrhh: Users,
  facturacion: ReceiptText,
  documentos: FileText,
  tablero: Kanban,
  gastos: CreditCard,
  it: Laptop,
}
