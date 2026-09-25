
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue text,
  ADD COLUMN IF NOT EXISTS halls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS map_extra_urls text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';
