CREATE TABLE public.lunar_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  pair_code text NOT NULL UNIQUE CHECK (pair_code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  telegram_chat_id text UNIQUE,
  state jsonb NOT NULL,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lunar_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.lunar_missions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('navigator', 'engineer')),
  token_hash text NOT NULL UNIQUE,
  bind_code text NOT NULL UNIQUE,
  telegram_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, role),
  UNIQUE (mission_id, telegram_user_id)
);

CREATE INDEX lunar_players_mission_idx ON public.lunar_players(mission_id);
CREATE INDEX lunar_missions_pair_idx ON public.lunar_missions(pair_code);
CREATE INDEX lunar_missions_chat_idx ON public.lunar_missions(telegram_chat_id);

ALTER TABLE public.lunar_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lunar_players ENABLE ROW LEVEL SECURITY;

-- There are intentionally no public RLS policies: game mutations and role
-- projections run through server functions using the service role.
