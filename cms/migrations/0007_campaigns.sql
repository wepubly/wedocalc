CREATE TABLE calculator_audits (
 id TEXT PRIMARY KEY,
 calculator_id TEXT NOT NULL REFERENCES routes(id),
 calculator_url TEXT NOT NULL,
 formula_checked TEXT NOT NULL,
 test_inputs TEXT NOT NULL,
 expected_result TEXT NOT NULL,
 observed_result TEXT NOT NULL,
 auditor TEXT NOT NULL,
 verdict TEXT NOT NULL CHECK(verdict IN ('passed','failed')),
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL
);
CREATE INDEX audits_calculator_recent ON calculator_audits(calculator_id,created_at DESC);
CREATE TABLE editorial_campaigns (
 id TEXT PRIMARY KEY,
 calculator_id TEXT NOT NULL REFERENCES routes(id),
 start_date TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled')),
 audit_id TEXT NOT NULL REFERENCES calculator_audits(id),
 created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX one_scheduled_campaign_per_calculator ON editorial_campaigns(calculator_id) WHERE status='scheduled';
CREATE TABLE editorial_campaign_items (
 campaign_id TEXT NOT NULL REFERENCES editorial_campaigns(id),
 article_id TEXT NOT NULL REFERENCES articles(id),
 version INTEGER NOT NULL,
 day_number INTEGER NOT NULL CHECK(day_number BETWEEN 1 AND 14),
 schedule_id TEXT NOT NULL REFERENCES schedules(id),
 PRIMARY KEY(campaign_id,day_number),
 UNIQUE(campaign_id,article_id)
);
