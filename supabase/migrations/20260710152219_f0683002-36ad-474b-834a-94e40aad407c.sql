REVOKE EXECUTE ON FUNCTION public.has_valid_share_token(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_valid_teacher_share(uuid, text) FROM anon, authenticated, public;