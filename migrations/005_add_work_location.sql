-- Migration: Add work_location column to jobs table

ALTER TABLE jobs ADD COLUMN work_location TEXT;
