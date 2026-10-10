CREATE TABLE BusinessHistoryBudget (
  businessId TEXT PRIMARY KEY,
  bytes INTEGER NOT NULL DEFAULT 0,
  rows INTEGER NOT NULL DEFAULT 0
);
INSERT INTO BusinessHistoryBudget(businessId,bytes,rows)
  SELECT businessId,sum(coalesce(length(CAST(beforeJson AS BLOB)),0)+coalesce(length(CAST(afterJson AS BLOB)),0)+300),count(*)
  FROM BusinessHistory GROUP BY businessId;

CREATE TRIGGER business_history_quota BEFORE INSERT ON BusinessHistory
WHEN coalesce((SELECT bytes FROM BusinessHistoryBudget WHERE businessId=NEW.businessId),0)
  +coalesce(length(CAST(NEW.beforeJson AS BLOB)),0)+coalesce(length(CAST(NEW.afterJson AS BLOB)),0)+300>5242880
  OR coalesce((SELECT rows FROM BusinessHistoryBudget WHERE businessId=NEW.businessId),0)>=5000
BEGIN SELECT RAISE(ABORT,'BUSINESS_HISTORY_QUOTA'); END;

CREATE TRIGGER business_history_budget AFTER INSERT ON BusinessHistory
BEGIN
  INSERT INTO BusinessHistoryBudget(businessId,bytes,rows)
    VALUES (NEW.businessId,coalesce(length(CAST(NEW.beforeJson AS BLOB)),0)+coalesce(length(CAST(NEW.afterJson AS BLOB)),0)+300,1)
    ON CONFLICT(businessId) DO UPDATE SET bytes=bytes+excluded.bytes,rows=rows+1;
END;
