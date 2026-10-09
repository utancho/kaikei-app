-- Old metadata is not proof of an active credential; revalidate on the next authenticated request.
ALTER TABLE SessionActivity ADD COLUMN securityVersion INTEGER NOT NULL DEFAULT -1;
CREATE INDEX SessionActivity_version ON SessionActivity(userId,securityVersion);
