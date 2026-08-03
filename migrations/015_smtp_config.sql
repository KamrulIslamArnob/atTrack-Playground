-- SMTP configuration table (user-scoped, encrypted credentials)
-- Stores Gmail SMTP settings for sending application emails

CREATE TABLE IF NOT EXISTS public.smtp_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host text NOT NULL DEFAULT 'smtp.gmail.com',
  port integer NOT NULL DEFAULT 465,
  user_email text NOT NULL,
  encrypted_password text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT smtp_config_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own SMTP config"
  ON public.smtp_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own SMTP config"
  ON public.smtp_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own SMTP config"
  ON public.smtp_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own SMTP config"
  ON public.smtp_config FOR DELETE
  USING (auth.uid() = user_id);
