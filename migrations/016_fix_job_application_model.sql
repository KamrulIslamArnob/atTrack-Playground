-- Migration 016: Fix Job vs Application model
-- Jobs = pipeline stages (pre-application only)
-- Applications = independent entity with full lifecycle
-- application_emails = track every email sent through the system

-- =============================================
-- 1. Fix jobs.status: only pre-application stages
-- =============================================

-- Drop old constraint
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

-- Migrate existing data: application-stage statuses should not exist on jobs
-- Map applied/interview/offer/accepted/rejected/withdrawn -> 'preparing'
-- These will now live on applications table instead
UPDATE jobs SET status = 'preparing' 
WHERE status IN ('applied', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn');

-- New constraint: only pre-application pipeline stages
ALTER TABLE jobs
  ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('saved', 'interested', 'preparing'));

ALTER TABLE jobs ALTER COLUMN status SET DEFAULT 'saved';

-- =============================================
-- 2. Fix applications.status: full application lifecycle
-- =============================================

-- Drop old constraint
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;

-- Migrate existing data to new status values
-- Old 'saved' -> 'draft', old 'applied' -> 'submitted', etc.
UPDATE applications SET status = 'draft' WHERE status = 'saved';
UPDATE applications SET status = 'submitted' WHERE status = 'applied';
UPDATE applications SET status = 'submitted' WHERE status = 'interested';
UPDATE applications SET status = 'submitted' WHERE status = 'preparing';
UPDATE applications SET status = 'interview' WHERE status = 'interview';
UPDATE applications SET status = 'offer' WHERE status = 'offer';
UPDATE applications SET status = 'accepted' WHERE status = 'accepted';
UPDATE applications SET status = 'rejected' WHERE status = 'rejected';
UPDATE applications SET status = 'withdrawn' WHERE status = 'withdrawn';

-- New constraint: full application lifecycle
ALTER TABLE applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN ('draft', 'submitted', 'acknowledged', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn'));

ALTER TABLE applications ALTER COLUMN status SET DEFAULT 'draft';

-- Add columns to applications for tracking
ALTER TABLE applications ADD COLUMN IF NOT EXISTS resume_id UUID REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS resume_name TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS notes TEXT;

-- =============================================
-- 3. Create application_emails table
-- =============================================

CREATE TABLE IF NOT EXISTS application_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  
  -- Email content
  recipient_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  
  -- Resume attachment
  resume_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  resume_name TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT,
  
  -- Timestamps
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for application_emails
ALTER TABLE application_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own application emails"
  ON application_emails FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own application emails"
  ON application_emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own application emails"
  ON application_emails FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own application emails"
  ON application_emails FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_application_emails_job_id ON application_emails(job_id);
CREATE INDEX IF NOT EXISTS idx_application_emails_application_id ON application_emails(application_id);
CREATE INDEX IF NOT EXISTS idx_application_emails_user_id ON application_emails(user_id);
