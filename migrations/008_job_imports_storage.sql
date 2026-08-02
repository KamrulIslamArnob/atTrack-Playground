-- Create private 'job-imports' bucket for temporary screenshot storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-imports', 'job-imports', false);

-- RLS: Users can only upload their own job import screenshots
CREATE POLICY "Users can upload job import screenshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'job-imports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Users can only read their own job import screenshots
CREATE POLICY "Users can read their own job import screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'job-imports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Users can only delete their own job import screenshots
CREATE POLICY "Users can delete their own job import screenshots"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'job-imports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
