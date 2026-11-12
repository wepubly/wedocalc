CREATE TABLE IF NOT EXISTS lab_trusted_auditors (agent_id TEXT PRIMARY KEY REFERENCES agents(id), created_at TEXT NOT NULL);
