-- Bind every posted invoice to one immutable journal entry.
CREATE TABLE InvoicePostingClaim (
  invoiceId TEXT PRIMARY KEY REFERENCES Invoice(id),
  businessId TEXT NOT NULL REFERENCES Business(id),
  journalEntryId TEXT NOT NULL UNIQUE REFERENCES JournalEntry(id) DEFERRABLE INITIALLY DEFERRED,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER invoice_posting_claim_validate BEFORE INSERT ON InvoicePostingClaim
WHEN NOT EXISTS(
  SELECT 1 FROM Invoice
  WHERE id=NEW.invoiceId AND businessId=NEW.businessId AND status='DRAFT'
)
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTING_UNAVAILABLE'); END;

CREATE TRIGGER invoice_posting_claim_matches BEFORE INSERT ON InvoicePostingClaim
WHEN NOT EXISTS(
  SELECT 1 FROM Invoice i JOIN JournalEntry j ON j.id=NEW.journalEntryId
  WHERE i.id=NEW.invoiceId AND i.businessId=NEW.businessId AND j.businessId=i.businessId
    AND j.source='INVOICE' AND j.status='CONFIRMED' AND julianday(j.entryDate)=julianday(i.issueDate)
    AND i.total=i.subtotal+i.taxAmount
    AND (SELECT count(*) FROM JournalEntryLine WHERE journalEntryId=j.id)=2+(i.taxAmount>0)
    AND NOT EXISTS(SELECT 1 FROM JournalEntryLine l JOIN Account a ON a.id=l.accountId
      WHERE l.journalEntryId=j.id AND (a.businessId<>i.businessId OR l.partnerId IS NOT i.partnerId))
    AND (SELECT coalesce(sum(l.amount),0) FROM JournalEntryLine l JOIN Account a ON a.id=l.accountId
      WHERE l.journalEntryId=j.id AND l.side='DEBIT' AND a.code='1110')=i.total
    AND (SELECT coalesce(sum(l.amount),0) FROM JournalEntryLine l JOIN Account a ON a.id=l.accountId
      WHERE l.journalEntryId=j.id AND l.side='CREDIT' AND a.code='4010')=i.subtotal
    AND (SELECT coalesce(sum(l.amount),0) FROM JournalEntryLine l JOIN Account a ON a.id=l.accountId
      WHERE l.journalEntryId=j.id AND l.side='CREDIT' AND a.code='2055')=i.taxAmount
)
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTING_MISMATCH'); END;

CREATE TRIGGER invoice_posting_claim_immutable_update BEFORE UPDATE ON InvoicePostingClaim
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTING_CLAIM_IMMUTABLE'); END;

CREATE TRIGGER invoice_posting_claim_immutable_delete BEFORE DELETE ON InvoicePostingClaim
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTING_CLAIM_IMMUTABLE'); END;

-- Once claimed, financial fields are immutable. Only the controlled lifecycle
-- transitions DRAFT -> SENT -> PAID are allowed.
CREATE TRIGGER posted_invoice_immutable BEFORE UPDATE ON Invoice
WHEN EXISTS(SELECT 1 FROM InvoicePostingClaim WHERE invoiceId=OLD.id)
AND NOT(
  NEW.id IS OLD.id AND
  NEW.businessId IS OLD.businessId AND
  NEW.partnerId IS OLD.partnerId AND
  NEW.invoiceNumber IS OLD.invoiceNumber AND
  NEW.issueDate IS OLD.issueDate AND
  NEW.dueDate IS OLD.dueDate AND
  NEW.notes IS OLD.notes AND
  NEW.subtotal IS OLD.subtotal AND
  NEW.taxAmount IS OLD.taxAmount AND
  NEW.total IS OLD.total AND
  NEW.createdAt IS OLD.createdAt AND
  ((OLD.status='DRAFT' AND NEW.status='SENT') OR (OLD.status='SENT' AND NEW.status='PAID'))
)
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTED'); END;

CREATE TRIGGER posted_invoice_no_delete BEFORE DELETE ON Invoice
WHEN EXISTS(SELECT 1 FROM InvoicePostingClaim WHERE invoiceId=OLD.id)
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTED'); END;

CREATE TRIGGER posted_invoice_item_no_insert BEFORE INSERT ON InvoiceItem
WHEN EXISTS(SELECT 1 FROM InvoicePostingClaim WHERE invoiceId=NEW.invoiceId)
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTED'); END;

CREATE TRIGGER posted_invoice_item_no_update BEFORE UPDATE ON InvoiceItem
WHEN EXISTS(SELECT 1 FROM InvoicePostingClaim WHERE invoiceId=OLD.invoiceId)
  OR EXISTS(SELECT 1 FROM InvoicePostingClaim WHERE invoiceId=NEW.invoiceId)
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTED'); END;

CREATE TRIGGER posted_invoice_item_no_delete BEFORE DELETE ON InvoiceItem
WHEN EXISTS(SELECT 1 FROM InvoicePostingClaim WHERE invoiceId=OLD.invoiceId)
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTED'); END;

CREATE TRIGGER posted_journal_no_update BEFORE UPDATE ON JournalEntry
WHEN EXISTS(SELECT 1 FROM InvoicePostingClaim WHERE journalEntryId=OLD.id)
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTED'); END;

CREATE TRIGGER posted_journal_no_delete BEFORE DELETE ON JournalEntry
WHEN EXISTS(SELECT 1 FROM InvoicePostingClaim WHERE journalEntryId=OLD.id)
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTED'); END;

CREATE TRIGGER posted_journal_line_no_insert BEFORE INSERT ON JournalEntryLine
WHEN EXISTS(SELECT 1 FROM InvoicePostingClaim WHERE journalEntryId=NEW.journalEntryId)
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTED'); END;

CREATE TRIGGER posted_journal_line_no_update BEFORE UPDATE ON JournalEntryLine
WHEN EXISTS(SELECT 1 FROM InvoicePostingClaim WHERE journalEntryId=OLD.journalEntryId)
  OR EXISTS(SELECT 1 FROM InvoicePostingClaim WHERE journalEntryId=NEW.journalEntryId)
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTED'); END;

CREATE TRIGGER posted_journal_line_no_delete BEFORE DELETE ON JournalEntryLine
WHEN EXISTS(SELECT 1 FROM InvoicePostingClaim WHERE journalEntryId=OLD.journalEntryId)
BEGIN SELECT RAISE(ABORT,'INVOICE_POSTED'); END;
