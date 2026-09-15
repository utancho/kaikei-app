-- CreateIndex
CREATE INDEX "JournalEntry_businessId_status_entryDate_idx" ON "JournalEntry"("businessId", "status", "entryDate");
