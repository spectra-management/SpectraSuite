import { logAuditEvent } from '@/shared/lib/audit'
import { useEmployeesStore } from '@/shared/store/employeesStore'
import type { Employee } from '@/shared/types'

/**
 * Permanent payroll inclusion flag. A missing value (legacy records) is treated as
 * active, so always test for the explicit `false`.
 */
export function isPayrollActive(emp: Pick<Employee, 'payroll_active'>): boolean {
  return emp.payroll_active !== false
}

/**
 * Flip an employee's permanent payroll_active flag, persist it (localStorage source
 * of truth, mirrored per the store), and write a server-side audit entry. Shared by
 * the employee profile and the Review Hours table so both behave identically.
 */
export function setEmployeePayrollActive(
  employee: Employee,
  active: boolean,
  source: 'profile' | 'review_hours',
): void {
  useEmployeesStore.getState().updateEmployee(employee.id, { payroll_active: active })
  void logAuditEvent({
    action: active ? 'employee_payroll_activated' : 'employee_payroll_deactivated',
    category: 'payroll',
    resource_type: 'employee',
    resource_id: employee.id,
    details: {
      employee_name: `${employee.firstName} ${employee.lastName}`.trim(),
      bamboohr_id: employee.id,
      source,
    },
    status: 'success',
  })
}
