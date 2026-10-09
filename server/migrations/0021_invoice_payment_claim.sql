CREATE TABLE InvoicePaymentClaim (
  invoiceId TEXT PRIMARY KEY REFERENCES Invoice(id),
  businessId TEXT NOT NULL REFERENCES Business(id),
  paymentDate TEXT NOT NULL CHECK(date(paymentDate) IS NOT NULL),
  journalEntryId TEXT NOT NULL UNIQUE REFERENCES JournalEntry(id) DEFERRABLE INITIALLY DEFERRED
);
-- Keep trigger bodies single-level: the remote D1 splitter can confuse unparenthesized CASE END with trigger END.
CREATE TRIGGER invoice_payment_claim_validate BEFORE INSERT ON InvoicePaymentClaim WHEN NOT EXISTS(SELECT 1 FROM Invoice WHERE id=NEW.invoiceId AND businessId=NEW.businessId AND status='SENT') BEGIN SELECT RAISE(ABORT,'INVOICE_PAYMENT_UNAVAILABLE'); END;
CREATE TRIGGER invoice_payment_claim_closed BEFORE INSERT ON InvoicePaymentClaim WHEN EXISTS(SELECT 1 FROM BusinessControl WHERE businessId=NEW.businessId AND closedThrough IS NOT NULL AND date(NEW.paymentDate)<=closedThrough) BEGIN SELECT RAISE(ABORT,'PERIOD_LOCKED'); END;
CREATE TRIGGER invoice_payment_claim_immutable_update BEFORE UPDATE ON InvoicePaymentClaim BEGIN SELECT RAISE(ABORT,'PAYMENT_CLAIM_IMMUTABLE'); END;
CREATE TRIGGER invoice_payment_claim_immutable_delete BEFORE DELETE ON InvoicePaymentClaim BEGIN SELECT RAISE(ABORT,'PAYMENT_CLAIM_IMMUTABLE'); END;
