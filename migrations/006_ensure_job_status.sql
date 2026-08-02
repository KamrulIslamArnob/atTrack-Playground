-- Migration: Ensure jobs table has status column with correct check constraint
-- The status column already exists from 001, but let's ensure it's properly set

-- Update any null statuses to 'saved'
UPDATE jobs SET status = 'saved' WHERE status IS NULL;

-- Add NOT NULL constraint if not already present
ALTER TABLE jobs ALTER COLUMN status SET DEFAULT 'saved';
