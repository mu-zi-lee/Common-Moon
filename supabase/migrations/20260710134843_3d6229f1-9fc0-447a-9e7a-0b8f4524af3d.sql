
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
