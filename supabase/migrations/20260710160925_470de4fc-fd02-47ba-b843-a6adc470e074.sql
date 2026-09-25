
CREATE POLICY "guides read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'guides' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "guides insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'guides' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "guides update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'guides' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "guides delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'guides' AND (storage.foldername(name))[1] = auth.uid()::text);
