ALTER TABLE User ADD COLUMN emailVerifiedAt TEXT;
CREATE TABLE EmailVerification (tokenHash TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE, email TEXT NOT NULL, expiresAt INTEGER NOT NULL, usedAt INTEGER);
CREATE INDEX EmailVerification_expiry ON EmailVerification(expiresAt);
CREATE TABLE SessionActivity (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE, tokenHash TEXT NOT NULL UNIQUE, userAgent TEXT NOT NULL, createdAt INTEGER NOT NULL, lastSeenAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL);
CREATE INDEX SessionActivity_owner ON SessionActivity(userId,lastSeenAt);
CREATE INDEX SessionActivity_expiry ON SessionActivity(expiresAt);
CREATE TABLE AccountNotification (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE, kind TEXT NOT NULL, message TEXT NOT NULL, createdAt INTEGER NOT NULL, readAt INTEGER);
CREATE INDEX AccountNotification_owner ON AccountNotification(userId,createdAt);
CREATE TABLE EmailDailyUsage (day TEXT PRIMARY KEY, attempts INTEGER NOT NULL CHECK(attempts BETWEEN 1 AND 90));
