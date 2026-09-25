
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
