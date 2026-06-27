-- 018_portal_news_rewards.sql
--
-- Employee self-service portal extras shown on the normal-user mini-home:
--   1. portal_news    -- an announcements/news board. READ: any authenticated user.
--                        WRITE: managers (super_admin or module_admin).
--   2. portal_rewards -- per-user daily check-in gamification (points + streak + best streak +
--                        total days). Each user reads/writes ONLY their own row.
--
-- The reward system can be turned on/off by the super admin; that flag lives in app_state
-- (key 'rewards_enabled'), not here -- no schema needed for it.
--
-- MANUAL RUN ONLY -- not auto-applied. Idempotent. Additive: two tables + helper + RLS.
-- Pure ASCII (copy/pastes cleanly into the Supabase SQL editor).

-- Managers = super_admin or module_admin (reusable helper).
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'module_admin');
$$;

-- 1. News board.
CREATE TABLE IF NOT EXISTS public.portal_news (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_news_created_idx ON public.portal_news(created_at DESC);

ALTER TABLE public.portal_news ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can READ the news.
DROP POLICY IF EXISTS "portal_news_read" ON public.portal_news;
CREATE POLICY "portal_news_read" ON public.portal_news
  FOR SELECT TO authenticated USING (TRUE);

-- Only managers can WRITE (insert/update/delete).
DROP POLICY IF EXISTS "portal_news_write" ON public.portal_news;
CREATE POLICY "portal_news_write" ON public.portal_news
  FOR ALL TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());

-- 2. Per-user daily rewards. The row id IS the user (auth.uid()).
CREATE TABLE IF NOT EXISTS public.portal_rewards (
  user_id       UUID PRIMARY KEY,
  points        INTEGER NOT NULL DEFAULT 0,
  streak        INTEGER NOT NULL DEFAULT 0,
  best_streak   INTEGER NOT NULL DEFAULT 0,
  total_days    INTEGER NOT NULL DEFAULT 0,
  last_check_in DATE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_rewards ENABLE ROW LEVEL SECURITY;

-- A user can read ONLY their own rewards row.
DROP POLICY IF EXISTS "portal_rewards_read" ON public.portal_rewards;
CREATE POLICY "portal_rewards_read" ON public.portal_rewards
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- A user can create/update ONLY their own rewards row.
DROP POLICY IF EXISTS "portal_rewards_insert" ON public.portal_rewards;
CREATE POLICY "portal_rewards_insert" ON public.portal_rewards
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "portal_rewards_update" ON public.portal_rewards;
CREATE POLICY "portal_rewards_update" ON public.portal_rewards
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Done. News board (manager-written, all-read) + per-user daily rewards (self only).
