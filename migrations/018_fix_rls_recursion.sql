-- Migration 018: Fix RLS infinite recursion in admin policies
-- The admin policies in migration 017 referenced profiles inside the policy
-- on profiles, causing "infinite recursion detected in policy for relation profiles"
-- and breaking ALL reads/writes to profiles (including a user's own profile).

-- Security definer helper that checks admin role while bypassing RLS.
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

-- Recreate all admin policies to use is_admin() instead of inline subqueries.

DROP POLICY IF EXISTS "Admins can view all activity logs" ON activity_logs;
CREATE POLICY "Admins can view all activity logs"
  ON activity_logs FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all AI usage logs" ON ai_usage_logs;
CREATE POLICY "Admins can view all AI usage logs"
  ON ai_usage_logs FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all jobs" ON jobs;
CREATE POLICY "Admins can view all jobs"
  ON jobs FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all applications" ON applications;
CREATE POLICY "Admins can view all applications"
  ON applications FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all documents" ON documents;
CREATE POLICY "Admins can view all documents"
  ON documents FOR SELECT
  USING (public.is_admin());
