-- Set default employment_type to 'Full-time' for existing NULL values
UPDATE jobs SET employment_type = 'Full-time' WHERE employment_type IS NULL;

-- Set the column default
ALTER TABLE jobs ALTER COLUMN employment_type SET DEFAULT 'Full-time';
