CREATE POLICY "own merch objects" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'merch' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'merch' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "own audio objects" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);