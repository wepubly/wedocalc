-- Additive only: existing snapshots/publications remain intact, but are not
-- automatically marked as approved. New publication requires a reviewed version.
CREATE TABLE editorial_reviews (
 article_id TEXT NOT NULL, version INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('review','changes','approved')),
 reviewer TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL,
 PRIMARY KEY(article_id,version),
 FOREIGN KEY(article_id,version) REFERENCES article_versions(article_id,version)
);
CREATE TABLE editorial_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 article_id TEXT NOT NULL, version INTEGER NOT NULL,
 action TEXT NOT NULL, actor TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 FOREIGN KEY(article_id,version) REFERENCES article_versions(article_id,version)
);
CREATE INDEX editorial_history ON editorial_events(article_id,id);
ALTER TABLE media ADD COLUMN width INTEGER;
ALTER TABLE media ADD COLUMN height INTEGER;

