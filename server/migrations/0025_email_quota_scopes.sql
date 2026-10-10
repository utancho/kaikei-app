-- Preserve already consumed provider capacity while introducing tenant scopes.
ALTER TABLE EmailDailyUsage RENAME TO EmailDailyUsageLegacy;
CREATE TABLE EmailDailyUsage (
  day TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'legacy',
  attempts INTEGER NOT NULL CHECK(attempts BETWEEN 1 AND 90),
  PRIMARY KEY(day,scope)
);
INSERT INTO EmailDailyUsage(day,scope,attempts) SELECT day,'legacy',attempts FROM EmailDailyUsageLegacy;
DROP TABLE EmailDailyUsageLegacy;
