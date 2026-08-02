-- MCQ test results table
CREATE TABLE mcq_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  answers JSONB NOT NULL,
  questions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_mcq_results_user_id ON mcq_results(user_id);
CREATE INDEX idx_mcq_results_job_id ON mcq_results(job_id);

-- RLS
ALTER TABLE mcq_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own mcq results"
  ON mcq_results FOR ALL
  USING (auth.uid() = user_id);
