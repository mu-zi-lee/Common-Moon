
DROP FUNCTION IF EXISTS public.home_stats(uuid);

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
