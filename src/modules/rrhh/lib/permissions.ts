/**
 * RRHH sensitive-data access gate.
 *
 * Some profile data is sensitive: Compensation, Documents, and the national-ID / SSN
 * field. We reuse the SAME RBAC the rest of the Suite uses (`useAuth().hasModuleAccess`)
 * — no parallel permission system.
 *
 * CHOSEN FLAG: `hasModuleAccess('rrhh', 'edit')`.
 *   - There is no dedicated "sensitive HR data" permission in the schema
 *     (`PermAction = 'view' | 'edit' | 'approve' | 'admin'`), so per the brief we pick
 *     the most restrictive sensible option above plain view.
 *   - `'edit'` requires `can_view && can_edit`, so a user with ONLY basic `can_view`
 *     (read-only directory access) does NOT pass — they cannot see Compensation or
 *     Documents and the national ID stays masked.
 *   - `super_admin` and legacy `module_admin` bypass (they pass every action), as
 *     elsewhere in the app.
 *
 * If you'd rather restrict sensitive HR data even further (to `'admin'` only), change
 * the `'edit'` argument below. Documented in RRHH_PROGRESS.md for confirmation.
 *
 * ADMIN-ONLY actions (custom photo upload/remove) use the STRONGER `'admin'` gate:
 * `hasModuleAccess('rrhh', 'admin')` → true only for `can_admin` on RRHH, or the
 * bypassing `super_admin` / legacy `module_admin` roles. This is the strongest
 * admin-level check available without inventing a new permission.
 */

import { useAuth } from '@/shared/context/AuthContext'

export interface RrhhAccess {
  /** May the viewer see Compensation, Documents, and the unmasked national ID? (edit-level) */
  canViewSensitive: boolean
  /** May the viewer upload/remove a custom employee photo? (admin-level) */
  canManagePhotos: boolean
}

export function useRrhhAccess(): RrhhAccess {
  const { hasModuleAccess } = useAuth()
  return {
    canViewSensitive: hasModuleAccess('rrhh', 'edit'),
    canManagePhotos: hasModuleAccess('rrhh', 'admin'),
  }
}
