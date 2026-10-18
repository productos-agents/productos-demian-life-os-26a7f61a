-- Files uploaded to DEMIAN and organized into the user's Second Brain.
CREATE TABLE IF NOT EXISTS public.demian_brain_files (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.demian_users(id) ON DELETE CASCADE,
  note_id BIGINT NULL REFERENCES public.demian_items(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size BIGINT NOT NULL CHECK (file_size >= 0 AND file_size <= 8388608),
  file_data BYTEA NOT NULL,
  extracted_text TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Pendiente de organizar',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'organized', 'saved-unorganized')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS demian_brain_files_user_created_idx
  ON public.demian_brain_files(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS demian_brain_files_user_status_idx
  ON public.demian_brain_files(user_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.demian_brain_files TO demian_life_os_app;