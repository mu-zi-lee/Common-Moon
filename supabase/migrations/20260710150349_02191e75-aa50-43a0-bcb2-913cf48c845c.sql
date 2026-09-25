REVOKE EXECUTE ON FUNCTION public.has_valid_share_token(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_valid_share_token(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_valid_share_token(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_valid_share_token(uuid) TO service_role;