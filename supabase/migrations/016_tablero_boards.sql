-- 016_tablero_boards.sql
--
-- "Tablero" — a Trello-like kanban for managers. Boards → lists (columns) → cards. Card detail
-- (labels, checklist, comments) is stored as JSONB on the card (edited within one card, low
-- cross-row contention); moving/reordering cards is row-level so concurrent managers don't clash.
--
-- ADMIN-ONLY: read + write require super_admin or module_admin (the "managers"). No new RBAC
-- module name is registered, so there are no module/audit CHECK-constraint changes.
--
-- MANUAL RUN ONLY -- not auto-applied. Idempotent. Additive: three tables + helper + RLS.
-- Pure ASCII on purpose (copy/pastes cleanly into the Supabase SQL editor).

-- Access helper: managers = super_admin or module_admin.
CREATE OR REPLACE FUNCTION public.tablero_can_manage()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'module_admin');
$$;

-- 1. Boards.
CREATE TABLE IF NOT EXISTS public.tablero_boards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT '',
  position    NUMERIC NOT NULL DEFAULT 0,
  archived    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Lists (columns) within a board.
CREATE TABLE IF NOT EXISTS public.tablero_lists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL REFERENCES public.tablero_boards(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT '',
  position   NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Cards within a list. Detail (labels/checklist/comments) is JSONB.
CREATE TABLE IF NOT EXISTS public.tablero_cards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES public.tablero_boards(id) ON DELETE CASCADE,
  list_id     UUID NOT NULL REFERENCES public.tablero_lists(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  assignee    TEXT NOT NULL DEFAULT '',
  due_date    TEXT NOT NULL DEFAULT '',
  labels      JSONB NOT NULL DEFAULT '[]'::jsonb,   -- array of color strings
  checklist   JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{id,text,done}]
  comments    JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{id,author,body,createdAt}]
  position    NUMERIC NOT NULL DEFAULT 0,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tablero_lists_board_idx ON public.tablero_lists(board_id);
CREATE INDEX IF NOT EXISTS tablero_cards_board_idx ON public.tablero_cards(board_id);
CREATE INDEX IF NOT EXISTS tablero_cards_list_idx ON public.tablero_cards(list_id);

-- RLS: managers only, for all three tables.
ALTER TABLE public.tablero_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tablero_lists  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tablero_cards  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tablero_boards_rw" ON public.tablero_boards;
CREATE POLICY "tablero_boards_rw" ON public.tablero_boards
  FOR ALL TO authenticated USING (public.tablero_can_manage()) WITH CHECK (public.tablero_can_manage());

DROP POLICY IF EXISTS "tablero_lists_rw" ON public.tablero_lists;
CREATE POLICY "tablero_lists_rw" ON public.tablero_lists
  FOR ALL TO authenticated USING (public.tablero_can_manage()) WITH CHECK (public.tablero_can_manage());

DROP POLICY IF EXISTS "tablero_cards_rw" ON public.tablero_cards;
CREATE POLICY "tablero_cards_rw" ON public.tablero_cards
  FOR ALL TO authenticated USING (public.tablero_can_manage()) WITH CHECK (public.tablero_can_manage());

-- Done. Admin/manager-only kanban. Run after the app is deployed; until then the module
-- shows empty (best-effort cloud reads).
