-- Additive migration: preserve existing users/data and legacy version-zero cookies.
ALTER TABLE "User" ADD COLUMN "securityVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "RevokedSession" ("tokenHash" TEXT PRIMARY KEY NOT NULL, "expiresAt" INTEGER NOT NULL);
CREATE INDEX "RevokedSession_expiry" ON "RevokedSession"("expiresAt");
CREATE TABLE "SecurityRateLimit" ("key" TEXT PRIMARY KEY NOT NULL, "attempts" INTEGER NOT NULL, "resetAt" INTEGER NOT NULL);
CREATE INDEX "SecurityRateLimit_expiry" ON "SecurityRateLimit"("resetAt");
