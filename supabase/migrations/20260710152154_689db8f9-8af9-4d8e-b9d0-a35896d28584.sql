-- Extend records with interactions and booth
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS interactions text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS booth text;

-- Merch (collection album: goods, tickets, posters, gifts, photo prints)
CREATE TABLE IF NOT EXISTS public.merch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  record_id uuid REFERENCES public.records(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'goods',
  name text NOT NULL,
  source text,
  price numeric,
  currency text NOT NULL DEFAULT 'CNY',
  photo_urls text[] NOT NULL DEFAULT '{}',
  note text,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  rating int NOT NULL DEFAULT 0,
  favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merch TO authenticated;
GRANT ALL ON public.merch TO service_role;
ALTER TABLE public.merch ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own merch all" ON public.merch FOR ALL TO public
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER merch_set_updated_at BEFORE UPDATE ON public.merch
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Expenses (per-event money breakdown)
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'CNY',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own expenses all" ON public.expenses FOR ALL TO public
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Teacher-level share tokens
CREATE TABLE IF NOT EXISTS public.teacher_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  teacher_name text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teacher_share_tokens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_share_tokens TO authenticated;
GRANT ALL ON public.teacher_share_tokens TO service_role;
ALTER TABLE public.teacher_share_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon reads valid teacher share tokens"
  ON public.teacher_share_tokens FOR SELECT TO anon
  USING (expires_at IS NULL OR expires_at > now());
CREATE POLICY "own teacher share tokens"
  ON public.teacher_share_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Helper for anon reading teacher-scoped shared records
CREATE OR REPLACE FUNCTION public.has_valid_teacher_share(_user_id uuid, _teacher_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_share_tokens
    WHERE user_id = _user_id AND teacher_name = _teacher_name
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;
CREATE POLICY "anon reads teacher-shared records"
  ON public.records FOR SELECT TO anon
  USING (teacher_name IS NOT NULL AND has_valid_teacher_share(user_id, teacher_name));

-- Follows: follow other CosLog users
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_user_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own follows all" ON public.follows FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Subscriptions: follow events or teacher names to surface on the me page
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'event',
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  teacher_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, event_id, teacher_name)
);
GRANT SELECT, INSERT, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscriptions all" ON public.subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS merch_user_acquired_idx ON public.merch(user_id, acquired_at DESC);
CREATE INDEX IF NOT EXISTS expenses_user_event_idx ON public.expenses(user_id, event_id);
CREATE INDEX IF NOT EXISTS records_user_teacher_idx ON public.records(user_id, teacher_name);
CREATE INDEX IF NOT EXISTS teacher_share_tokens_token_idx ON public.teacher_share_tokens(token);