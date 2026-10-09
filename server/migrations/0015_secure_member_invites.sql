-- Existing active memberships remain unchanged.
ALTER TABLE BusinessMember ADD COLUMN inviteTokenHash TEXT;
ALTER TABLE BusinessMember ADD COLUMN inviteExpiresAt DATETIME;
CREATE UNIQUE INDEX BusinessMember_inviteTokenHash_key ON BusinessMember(inviteTokenHash);
