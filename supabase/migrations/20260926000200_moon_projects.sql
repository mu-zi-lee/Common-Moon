CREATE TABLE public.moon_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  pair_code text NOT NULL UNIQUE CHECK (pair_code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  telegram_chat_id text UNIQUE,
  state jsonb NOT NULL,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.moon_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.moon_projects(id) ON DELETE CASCADE,
  slot integer NOT NULL CHECK (slot BETWEEN 1 AND 4),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  token_hash text NOT NULL UNIQUE,
  bind_code text NOT NULL UNIQUE,
  telegram_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slot),
  UNIQUE (project_id, telegram_user_id)
);

CREATE INDEX moon_members_project_idx ON public.moon_members(project_id);
ALTER TABLE public.moon_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moon_members ENABLE ROW LEVEL SECURITY;
-- Access and state transitions go through server functions using the service role.
