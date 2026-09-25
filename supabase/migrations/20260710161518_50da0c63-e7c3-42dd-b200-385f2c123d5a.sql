
-- Revoke anon direct table read; expose only token-resolution via SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "anon can read valid share tokens" ON public.share_tokens;
DROP POLICY IF EXISTS "anon reads valid teacher share tokens" ON public.teacher_share_tokens;
REVOKE SELECT ON public.share_tokens FROM anon;
REVOKE SELECT ON public.teacher_share_tokens FROM anon;

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
