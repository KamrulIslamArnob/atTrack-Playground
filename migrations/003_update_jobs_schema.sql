-- Migration: Update jobs table schema
-- Add employment_type, salary_range, application_url, deadline, source
-- Remove salary_min, salary_max, rename url to application_url

-- Add new columns
ALTER TABLE jobs ADD COLUMN employment_type TEXT;
ALTER TABLE jobs ADD COLUMN salary_range TEXT;
ALTER TABLE jobs ADD COLUMN application_url TEXT;
ALTER TABLE jobs ADD COLUMN deadline TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN source TEXT;

-- Copy data from url to application_url
UPDATE jobs SET application_url = url WHERE url IS NOT NULL;

-- Drop old columns
ALTER TABLE jobs DROP COLUMN url;
ALTER TABLE jobs DROP COLUMN salary_min;
ALTER TABLE jobs DROP COLUMN salary_max;
