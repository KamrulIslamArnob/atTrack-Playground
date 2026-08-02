-- Aven: Add avatar_url to profiles and create avatar storage bucket

-- Add avatar_url column to profiles
ALTER TABLE profiles ADD COLUMN avatar_url TEXT;

-- Create avatar storage bucket (public for profile images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatar', 'avatar', true);

-- Storage RLS policies for avatar bucket
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatar'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatar');

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatar'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatar'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
