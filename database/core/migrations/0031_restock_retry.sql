ALTER TABLE restock_notifications ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE restock_notifications ADD COLUMN last_error TEXT;
ALTER TABLE restock_notifications ADD COLUMN next_attempt_at TEXT;
