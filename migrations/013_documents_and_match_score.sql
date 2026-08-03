-- Migration 013: Documents enhancements + AI match score

-- Add columns to documents for resume content extraction
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS match_data JSONB;

-- Add columns to jobs for AI match scoring
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS match_score NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS matched_resume_id UUID REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS match_reasoning TEXT;

-- Unique partial index: only one default resume per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_one_default 
ON documents (user_id) WHERE is_default = true;
