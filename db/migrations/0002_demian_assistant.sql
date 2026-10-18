-- DOT DEMIAN: owner-scoped conversation storage for the native assistant module.
CREATE TABLE IF NOT EXISTS public.demian_assistant_conversations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.demian_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nueva conversación',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT demian_assistant_conversations_id_user_key UNIQUE (id, user_id)
);
CREATE INDEX IF NOT EXISTS demian_assistant_conversations_user_updated_idx
  ON public.demian_assistant_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.demian_assistant_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT demian_assistant_messages_conversation_owner_fk
    FOREIGN KEY (conversation_id, user_id)
    REFERENCES public.demian_assistant_conversations(id, user_id)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS demian_assistant_messages_conversation_created_idx
  ON public.demian_assistant_messages(conversation_id, user_id, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS demian_assistant_messages_user_created_idx
  ON public.demian_assistant_messages(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.demian_assistant_conversations, public.demian_assistant_messages
  TO demian_life_os_app;
GRANT USAGE, SELECT
  ON SEQUENCE public.demian_assistant_messages_id_seq
  TO demian_life_os_app;
