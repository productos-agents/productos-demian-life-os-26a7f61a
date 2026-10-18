-- Persistent, user-controlled memory for DEMIAN CORE.
CREATE TABLE IF NOT EXISTS public.demian_user_memories (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.demian_users(id) ON DELETE CASCADE,
  memory_key TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Preferencias',
  source_conversation_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT demian_user_memories_user_key UNIQUE (user_id, memory_key),
  CONSTRAINT demian_user_memories_content_length CHECK (char_length(content) BETWEEN 1 AND 2000)
);
CREATE INDEX IF NOT EXISTS demian_user_memories_user_updated_idx
  ON public.demian_user_memories(user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.demian_user_memories TO demian_life_os_app;