-- Add application_email and application_process columns to jobs table
-- Supports email-based applications (the most common application method)

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS application_email text,
ADD COLUMN IF NOT EXISTS application_process text;
