-- Drop the old constraint first
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;

-- Update existing rows to use the new status values
UPDATE applications SET status = 'saved' WHERE status = 'draft';
UPDATE applications SET status = 'applied' WHERE status = 'submitted';
UPDATE applications SET status = 'interview' WHERE status = 'interviewing';
UPDATE applications SET status = 'saved' WHERE status NOT IN ('saved','interested','preparing','applied','interview','offer','accepted','rejected','withdrawn');

-- Now add the new CHECK constraint
ALTER TABLE applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN ('saved','interested','preparing','applied','interview','offer','accepted','rejected','withdrawn'));

-- Update default to match
ALTER TABLE applications ALTER COLUMN status SET DEFAULT 'saved';
