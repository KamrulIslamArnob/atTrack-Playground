-- Migration: Add notes column to jobs table

ALTER TABLE jobs ADD COLUMN notes JSONB;
