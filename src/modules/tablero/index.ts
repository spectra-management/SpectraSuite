/**
 * Tablero (kanban) module — public API.
 *
 * A Trello-like board for managers: boards → lists → cards (labels, checklist,
 * comments, assignee, due date). Admin/manager-only (RLS migration 016). Persisted
 * directly in Supabase. Mounted at `/tablero` in `src/App.tsx`. Self-contained:
 * only depends on `@/shared/**` (see src/IMPORT_RULES.md).
 */
export { TableroLayout } from './components/TableroLayout'
export { BoardsPage } from './pages/BoardsPage'
export { BoardPage } from './pages/BoardPage'
