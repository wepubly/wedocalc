-- Isolated, staging-only editorial testing. Never use for approved production articles.
CREATE TABLE IF NOT EXISTS staging_test_articles (
 id TEXT PRIMARY KEY,
 slug TEXT NOT NULL UNIQUE,
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 image_id TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','test_published')),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS staging_test_images (
 id TEXT PRIMARY KEY,
 object_key TEXT NOT NULL UNIQUE,
 mime TEXT NOT NULL,
 size INTEGER NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS staging_test_articles_status ON staging_test_articles(status,updated_at);
