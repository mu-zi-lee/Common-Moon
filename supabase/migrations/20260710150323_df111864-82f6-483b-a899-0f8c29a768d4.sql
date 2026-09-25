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
GRANT SELECT ON public.share_tokens TO anon;
GRANT ALL ON public.share_tokens TO service_role;

ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own share tokens all" ON public.share_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "anon can read valid share tokens" ON public.share_tokens
  FOR SELECT TO anon
  USING (expires_at IS NULL OR expires_at > now());

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

-- Allow anon SELECT on records/events only when a valid share token exists.
CREATE POLICY "anon reads shared records" ON public.records
  FOR SELECT TO anon
  USING (public.has_valid_share_token(id));

CREATE POLICY "anon reads shared events" ON public.events
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.records r
    WHERE r.event_id = events.id AND public.has_valid_share_token(r.id)
  ));

-- Anon may read anon-legal photo/map paths via signed URLs; storage.objects
-- policies already gate access, so no changes there.

GRANT SELECT ON public.records TO anon;
GRANT SELECT ON public.events TO anon;