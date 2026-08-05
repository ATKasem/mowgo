-- job-photo bucket: photos are private to the owning business.
-- Existing objects remain in place, but private-bucket access is gated by these policies.
UPDATE storage.buckets SET public = false WHERE id = 'job-photo';

DROP POLICY IF EXISTS "job-photo: owner select" ON storage.objects;
DROP POLICY IF EXISTS "job-photo: owner insert" ON storage.objects;
DROP POLICY IF EXISTS "job-photo: owner update" ON storage.objects;
DROP POLICY IF EXISTS "job-photo: owner delete" ON storage.objects;

-- Photos live at {uploaderUserId}/{jobId}/{file}.jpg. Access rules:
--   SELECT (view + sign): the uploader, the business owner of the uploader,
--     and same-business crew (crew members share job photos).
--   INSERT/UPDATE/DELETE: the uploader only.
CREATE POLICY "job-photo: business select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'job-photo'
    AND (
      (storage.foldername(name))[1]::uuid = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = (storage.foldername(name))[1]::uuid
          AND (
            p.business_id = auth.uid()
            OR (
              p.business_id IS NOT NULL
              AND p.business_id = (SELECT business_id FROM profiles WHERE id = auth.uid())
            )
          )
      )
    )
  );

CREATE POLICY "job-photo: owner insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'job-photo'
    AND (storage.foldername(name))[1]::uuid = auth.uid()
  );

CREATE POLICY "job-photo: owner update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'job-photo'
    AND (storage.foldername(name))[1]::uuid = auth.uid()
  );

CREATE POLICY "job-photo: owner delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'job-photo'
    AND (storage.foldername(name))[1]::uuid = auth.uid()
  );
