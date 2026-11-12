ALTER TABLE media ADD COLUMN content_sha256 TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_editorial_media_content ON media(content_sha256) WHERE content_sha256 IS NOT NULL;
