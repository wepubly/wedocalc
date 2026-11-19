PRAGMA foreign_keys = ON;
CREATE TABLE articles (
 id TEXT PRIMARY KEY, draft_version INTEGER NOT NULL DEFAULT 0,
 published_version INTEGER, published_slug TEXT UNIQUE, published_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE article_versions (
 article_id TEXT NOT NULL REFERENCES articles(id), version INTEGER NOT NULL,
 snapshot TEXT NOT NULL CHECK(json_valid(snapshot)), created_at TEXT NOT NULL,
 PRIMARY KEY(article_id, version)
);
CREATE TABLE terms (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('category','tag')),
 name TEXT NOT NULL, slug TEXT NOT NULL, UNIQUE(kind,slug)
);
CREATE TABLE pitches (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','approved','archived')),
 created_at TEXT NOT NULL
);
CREATE TABLE schedules (
 id TEXT PRIMARY KEY, article_id TEXT NOT NULL, version INTEGER NOT NULL,
 run_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('queued','cancelled','published')),
 created_at TEXT NOT NULL,
 FOREIGN KEY(article_id,version) REFERENCES article_versions(article_id,version)
);
CREATE UNIQUE INDEX one_queued_schedule ON schedules(article_id) WHERE status='queued';
CREATE INDEX due_schedules ON schedules(status,run_at);
CREATE TABLE media (
 id TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 mime TEXT NOT NULL, size INTEGER NOT NULL, alt TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
);
CREATE TABLE login_limits (
 identity TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL
);
CREATE INDEX published_articles ON articles(published_at) WHERE published_version IS NOT NULL;

