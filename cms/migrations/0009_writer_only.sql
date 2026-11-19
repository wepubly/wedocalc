-- Retire all operational credentials that do not identify a Writer.
UPDATE agents SET active=0 WHERE NOT EXISTS (SELECT 1 FROM json_each(agents.scopes) WHERE value='submit');
ALTER TABLE calculator_audits ADD COLUMN approval_reference TEXT NOT NULL DEFAULT '';
