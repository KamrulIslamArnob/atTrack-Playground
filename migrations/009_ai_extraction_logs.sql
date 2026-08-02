-- Create AI extraction logs table
CREATE TABLE ai_extraction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  screenshot_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'error')),
  model TEXT NOT NULL DEFAULT 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  duration_ms INTEGER,
  extracted_fields TEXT[],
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying logs by user
CREATE INDEX idx_ai_extraction_logs_user_id ON ai_extraction_logs(user_id);

-- Index for querying logs by status
CREATE INDEX idx_ai_extraction_logs_status ON ai_extraction_logs(status);

-- RLS: Users can only read their own logs
ALTER TABLE ai_extraction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own extraction logs"
ON ai_extraction_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own extraction logs"
ON ai_extraction_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);
