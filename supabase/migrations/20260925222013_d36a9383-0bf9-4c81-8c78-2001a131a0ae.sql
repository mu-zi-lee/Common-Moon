-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  avatar_url TEXT,
  theme TEXT DEFAULT 'light',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  year INT,
  city TEXT,
  map_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events all" ON public.events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX events_user_idx ON public.events(user_id);

-- Records
CREATE TABLE public.records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  photo_url TEXT,
  teacher_name TEXT,
  character_name TEXT,
  anime_name TEXT,
  hall TEXT,
  marker_x REAL,
  marker_y REAL,
  note TEXT,
  favorite BOOLEAN NOT NULL DEFAULT false,
  rating INT NOT NULL DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.records TO authenticated;
GRANT ALL ON public.records TO service_role;
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own records all" ON public.records FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX records_user_idx ON public.records(user_id);
CREATE INDEX records_occurred_idx ON public.records(user_id, occurred_at DESC);

-- Contacts (multi)
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.records(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contacts all" ON public.contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tags
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tags all" ON public.tags FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Record Tags
CREATE TABLE public.record_tags (
  record_id UUID NOT NULL REFERENCES public.records(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (record_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.record_tags TO authenticated;
GRANT ALL ON public.record_tags TO service_role;
ALTER TABLE public.record_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own record_tags all" ON public.record_tags FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER records_updated_at BEFORE UPDATE ON public.records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Storage object policies for photos/maps/avatars
CREATE POLICY "own storage read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('photos','maps','avatars') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own storage insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('photos','maps','avatars') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own storage update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('photos','maps','avatars') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own storage delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('photos','maps','avatars') AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue text,
  ADD COLUMN IF NOT EXISTS halls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS map_extra_urls text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';

-- Performance indexes for records / tags
CREATE INDEX IF NOT EXISTS records_user_occurred_idx
  ON public.records (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS records_event_idx
  ON public.records (event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS record_tags_tag_idx
  ON public.record_tags (tag_id);

CREATE INDEX IF NOT EXISTS record_tags_record_idx
  ON public.record_tags (record_id);

CREATE UNIQUE INDEX IF NOT EXISTS tags_user_name_uniq
  ON public.tags (user_id, name);

CREATE INDEX IF NOT EXISTS contacts_record_idx
  ON public.contacts (record_id);

CREATE OR REPLACE FUNCTION public.home_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH month_rows AS (
    SELECT teacher_name, event_id
    FROM public.records
    WHERE occurred_at >= date_trunc('month', now())
  )
  SELECT json_build_object(
    'monthRecords', (SELECT count(*) FROM month_rows),
    'monthTeachers', (SELECT count(DISTINCT teacher_name) FROM month_rows WHERE teacher_name IS NOT NULL),
    'monthEvents', (SELECT count(DISTINCT event_id) FROM month_rows WHERE event_id IS NOT NULL),
    'totalRecords', (SELECT count(*) FROM public.records)
  );
$$;

GRANT EXECUTE ON FUNCTION public.home_stats() TO authenticated;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ai_summary jsonb,
  ADD COLUMN IF NOT EXISTS ai_summary_at timestamptz;

CREATE TABLE IF NOT EXISTS public.share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.records(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_tokens TO authenticated;
GRANT ALL ON public.share_tokens TO service_role;

ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own share tokens all" ON public.share_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS share_tokens_token_idx ON public.share_tokens(token);
CREATE INDEX IF NOT EXISTS share_tokens_record_idx ON public.share_tokens(record_id);

-- Helper: does an unexpired share token exist for this record?
CREATE OR REPLACE FUNCTION public.has_valid_share_token(_record_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.share_tokens
    WHERE record_id = _record_id
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

CREATE POLICY "anon reads shared records" ON public.records
  FOR SELECT TO anon
  USING (public.has_valid_share_token(id));

CREATE POLICY "anon reads shared events" ON public.events
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.records r
    WHERE r.event_id = events.id AND public.has_valid_share_token(r.id)
  ));

GRANT SELECT ON public.records TO anon;
GRANT SELECT ON public.events TO anon;

-- Extend records with interactions and booth
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS interactions text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS booth text;

-- Merch (collection album)
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
CREATE POLICY "own merch all" ON public.merch FOR ALL TO authenticated
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
CREATE POLICY "own expenses all" ON public.expenses FOR ALL TO authenticated
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_share_tokens TO authenticated;
GRANT ALL ON public.teacher_share_tokens TO service_role;
ALTER TABLE public.teacher_share_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own teacher share tokens"
  ON public.teacher_share_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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

-- Follows
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

-- Subscriptions
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

CREATE INDEX IF NOT EXISTS merch_user_acquired_idx ON public.merch(user_id, acquired_at DESC);
CREATE INDEX IF NOT EXISTS expenses_user_event_idx ON public.expenses(user_id, event_id);
CREATE INDEX IF NOT EXISTS records_user_teacher_idx ON public.records(user_id, teacher_name);
CREATE INDEX IF NOT EXISTS teacher_share_tokens_token_idx ON public.teacher_share_tokens(token);

REVOKE EXECUTE ON FUNCTION public.has_valid_share_token(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_valid_teacher_share(uuid, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.has_valid_share_token(uuid) TO service_role;

-- Storage policies for merch/audio
CREATE POLICY "own merch objects" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'merch' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'merch' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "own audio objects" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Guides
CREATE TABLE public.guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  title text,
  source_kind text NOT NULL DEFAULT 'mixed',
  source_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_text text,
  parsed jsonb,
  personalized jsonb,
  status text NOT NULL DEFAULT 'draft',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guides TO authenticated;
GRANT ALL ON public.guides TO service_role;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own guides" ON public.guides FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_guides_updated BEFORE UPDATE ON public.guides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX guides_user_created_idx ON public.guides(user_id, created_at DESC);
CREATE INDEX guides_event_idx ON public.guides(event_id);

CREATE TABLE public.guide_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id uuid NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  pinned boolean NOT NULL DEFAULT false,
  done boolean NOT NULL DEFAULT false,
  planned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guide_items TO authenticated;
GRANT ALL ON public.guide_items TO service_role;
ALTER TABLE public.guide_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own guide items" ON public.guide_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_guide_items_updated BEFORE UPDATE ON public.guide_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX guide_items_guide_idx ON public.guide_items(guide_id);
CREATE INDEX guide_items_user_idx ON public.guide_items(user_id, pinned, done);

-- Storage policies for guides
CREATE POLICY "guides read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'guides' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "guides insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'guides' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "guides update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'guides' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "guides delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'guides' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Token resolution RPCs for anonymous share pages
CREATE OR REPLACE FUNCTION public.resolve_share_token(_token text)
RETURNS TABLE(record_id uuid, expires_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT record_id, expires_at
  FROM public.share_tokens
  WHERE token = _token
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolve_teacher_share_token(_token text)
RETURNS TABLE(user_id uuid, teacher_name text, expires_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, teacher_name, expires_at
  FROM public.teacher_share_tokens
  WHERE token = _token
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_share_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_teacher_share_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_share_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_teacher_share_token(text) TO anon, authenticated;