-- Caps for anonymous staging tests, not for production editorial APIs.
CREATE TABLE IF NOT EXISTS staging_test_rate (
 visitor_id TEXT NOT NULL,
 hour_bucket TEXT NOT NULL,
 requests INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(visitor_id,hour_bucket)
);
CREATE INDEX IF NOT EXISTS staging_test_rate_bucket ON staging_test_rate(hour_bucket);
