ALTER TABLE public.demian_users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.demian_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.demian_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS demian_sessions_user_active_idx
  ON public.demian_sessions(user_id, expires_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS demian_sessions_expiry_idx ON public.demian_sessions(expires_at);

CREATE TABLE IF NOT EXISTS public.demian_password_reset_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.demian_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS demian_password_reset_tokens_user_idx
  ON public.demian_password_reset_tokens(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.demian_privacy_requests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES public.demian_users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('access','correction','deletion')),
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','completed','rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  resolution_note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS demian_privacy_requests_user_idx
  ON public.demian_privacy_requests(user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS demian_privacy_requests_status_idx
  ON public.demian_privacy_requests(status, requested_at ASC);
