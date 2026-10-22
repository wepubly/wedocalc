-- Standalone editorial schema for the production testing laboratory.

-- Original: cms/migrations/0001_editorial.sql
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



-- Original: cms/migrations/0002_schedule_errors.sql
ALTER TABLE schedules ADD COLUMN last_error TEXT;



-- Original: cms/migrations/0003_editorial_reviews.sql
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



-- Original: cms/migrations/0004_metricpedia.sql
CREATE TABLE owner (id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, iterations INTEGER NOT NULL, epoch INTEGER NOT NULL DEFAULT 1);
ALTER TABLE sessions ADD COLUMN epoch INTEGER NOT NULL DEFAULT 1;
ALTER TABLE media ADD COLUMN source TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN license TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN article_id TEXT;
CREATE TABLE routes (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('category','subcategory','calculator')), name TEXT NOT NULL, path TEXT NOT NULL UNIQUE, parent_id TEXT REFERENCES routes(id), state TEXT NOT NULL CHECK(state IN ('live','planned')));
INSERT INTO routes VALUES('home-garden','category','Home & Garden','/home-garden/',NULL,'live'),('paint-calculators','subcategory','Paint Calculators','/paint-calculators/','home-garden','live'),('paint-calculator','calculator','Paint Calculator','/paint-calculator/','paint-calculators','live');
INSERT INTO terms VALUES('home-garden','category','Home & Garden','home-garden');
CREATE TABLE briefs (id TEXT PRIMARY KEY, title TEXT NOT NULL, category_id TEXT NOT NULL REFERENCES routes(id), subcategory_id TEXT NOT NULL REFERENCES routes(id), calculator_id TEXT NOT NULL REFERENCES routes(id), primary_keyword TEXT NOT NULL, secondary_keywords TEXT NOT NULL CHECK(json_valid(secondary_keywords)), circuit INTEGER NOT NULL CHECK(circuit IN (1,2)), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL CHECK(json_valid(scopes)), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE submissions (external_id TEXT PRIMARY KEY, article_id TEXT NOT NULL UNIQUE REFERENCES articles(id), brief_id TEXT NOT NULL REFERENCES briefs(id), submitted_by TEXT NOT NULL REFERENCES agents(id));
CREATE TABLE submission_versions (external_id TEXT NOT NULL REFERENCES submissions(external_id), final_version TEXT NOT NULL, payload_hash TEXT NOT NULL, article_version INTEGER NOT NULL, PRIMARY KEY(external_id,final_version));
CREATE TABLE external_approvals (article_id TEXT NOT NULL, version INTEGER NOT NULL, digest TEXT NOT NULL, evidence TEXT NOT NULL, approved_by TEXT NOT NULL, approved_at TEXT NOT NULL, PRIMARY KEY(article_id,version), FOREIGN KEY(article_id,version) REFERENCES article_versions(article_id,version));
CREATE TABLE system_events (id INTEGER PRIMARY KEY AUTOINCREMENT,action TEXT NOT NULL,actor TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL);

