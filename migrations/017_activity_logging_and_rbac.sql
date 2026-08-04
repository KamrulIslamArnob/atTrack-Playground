-- Migration 017: Activity Logging, AI Usage Tracking, and Role-Based Access Control
-- Adds: activity_logs, ai_usage_logs tables; role, is_banned, banned_at columns on profiles

-- =============================================
-- 1. Add role and ban columns to profiles
-- =============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

-- =============================================
-- 2. Activity logs table (server-side audit trail)
-- =============================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own activity logs
CREATE POLICY "Users can view own activity logs"
  ON activity_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role (admin client) can insert activity logs
-- (RLS is bypassed by the admin client, but we add INSERT policy for the regular client too)
CREATE POLICY "Authenticated users can insert own activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 3. AI usage logs table
-- =============================================
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10, 6) DEFAULT 0,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_action ON ai_usage_logs(action);

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own AI usage logs
CREATE POLICY "Users can view own AI usage logs"
  ON ai_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Only authenticated users can insert their own AI usage logs
CREATE POLICY "Authenticated users can insert own AI usage logs"
  ON ai_usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 4. Admin RLS policies (admin can access all data)
-- =============================================

-- Security definer helper that checks admin role while bypassing RLS.
-- NOTE: Policies must reference this helper rather than inlining a
-- subquery on profiles, otherwise RLS infinite recursion breaks all
-- reads/writes on profiles (see migration 018).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- Activity logs: admin can view all
CREATE POLICY "Admins can view all activity logs"
  ON activity_logs FOR SELECT
  USING (public.is_admin());

-- AI usage logs: admin can view all
CREATE POLICY "Admins can view all AI usage logs"
  ON ai_usage_logs FOR SELECT
  USING (public.is_admin());

-- Profiles: admin can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin());

-- Profiles: admin can update any profile (for banning, role changes)
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (public.is_admin());

-- Jobs: admin can view all jobs
CREATE POLICY "Admins can view all jobs"
  ON jobs FOR SELECT
  USING (public.is_admin());

-- Applications: admin can view all
CREATE POLICY "Admins can view all applications"
  ON applications FOR SELECT
  USING (public.is_admin());

-- Documents: admin can view all
CREATE POLICY "Admins can view all documents"
  ON documents FOR SELECT
  USING (public.is_admin());
