-- Security membership history is separate from the finite accounting budget.
-- No foreign-key cascade may remove this evidence when a member is removed.
CREATE TABLE BusinessMemberAudit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  businessId TEXT NOT NULL,
  memberId TEXT NOT NULL,
  action TEXT NOT NULL,
  actorId TEXT,
  beforeJson TEXT,
  afterJson TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX member_audit_business ON BusinessMemberAudit(businessId,id);
CREATE TRIGGER member_audit_immutable_update BEFORE UPDATE ON BusinessMemberAudit BEGIN SELECT RAISE(ABORT,'IMMUTABLE_MEMBER_AUDIT'); END;
CREATE TRIGGER member_audit_immutable_delete BEFORE DELETE ON BusinessMemberAudit BEGIN SELECT RAISE(ABORT,'IMMUTABLE_MEMBER_AUDIT'); END;

CREATE TRIGGER member_audit_insert AFTER INSERT ON BusinessMember
BEGIN
  INSERT INTO BusinessMemberAudit(businessId,memberId,action,actorId,afterJson)
    VALUES (NEW.businessId,NEW.id,'MEMBER_INVITED',(SELECT ownerId FROM Business WHERE id=NEW.businessId),json_object('email',NEW.email,'role',NEW.role,'status',NEW.status,'userId',NEW.userId));
END;
CREATE TRIGGER member_audit_join AFTER UPDATE ON BusinessMember
WHEN OLD.status='PENDING' AND NEW.status='ACTIVE'
BEGIN
  INSERT INTO BusinessMemberAudit(businessId,memberId,action,actorId,beforeJson,afterJson)
    VALUES (NEW.businessId,NEW.id,'MEMBER_JOINED',NEW.userId,json_object('email',OLD.email,'role',OLD.role,'status',OLD.status,'userId',OLD.userId),json_object('email',NEW.email,'role',NEW.role,'status',NEW.status,'userId',NEW.userId));
END;
CREATE TRIGGER member_audit_change AFTER UPDATE ON BusinessMember
WHEN NOT(OLD.status='PENDING' AND NEW.status='ACTIVE')
BEGIN
  INSERT INTO BusinessMemberAudit(businessId,memberId,action,actorId,beforeJson,afterJson)
    VALUES (NEW.businessId,NEW.id,'MEMBER_CHANGED',(SELECT ownerId FROM Business WHERE id=NEW.businessId),json_object('email',OLD.email,'role',OLD.role,'status',OLD.status,'userId',OLD.userId),json_object('email',NEW.email,'role',NEW.role,'status',NEW.status,'userId',NEW.userId));
END;
CREATE TRIGGER member_audit_delete BEFORE DELETE ON BusinessMember
BEGIN
  INSERT INTO BusinessMemberAudit(businessId,memberId,action,actorId,beforeJson)
    VALUES (OLD.businessId,OLD.id,'MEMBER_REMOVED',(SELECT ownerId FROM Business WHERE id=OLD.businessId),json_object('email',OLD.email,'role',OLD.role,'status',OLD.status,'userId',OLD.userId));
END;
