
CREATE POLICY "own storage read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('photos','maps','avatars') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own storage insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('photos','maps','avatars') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own storage update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('photos','maps','avatars') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own storage delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('photos','maps','avatars') AND (storage.foldername(name))[1] = auth.uid()::text);
