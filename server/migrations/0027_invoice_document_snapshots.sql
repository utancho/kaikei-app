ALTER TABLE Business ADD COLUMN invoiceRegistrationNumber TEXT;
ALTER TABLE Invoice ADD COLUMN issuerJson TEXT;
ALTER TABLE Invoice ADD COLUMN recipientJson TEXT;
ALTER TABLE Invoice ADD COLUMN taxBreakdownJson TEXT;

-- Historical documents are not backfilled: today's master data cannot prove
-- what was printed on a previously issued invoice.
CREATE TRIGGER posted_invoice_snapshots_immutable BEFORE UPDATE ON Invoice
WHEN EXISTS(SELECT 1 FROM InvoicePostingClaim WHERE invoiceId=OLD.id)
AND (NEW.issuerJson IS NOT OLD.issuerJson OR NEW.recipientJson IS NOT OLD.recipientJson OR NEW.taxBreakdownJson IS NOT OLD.taxBreakdownJson)
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTED'); END;
