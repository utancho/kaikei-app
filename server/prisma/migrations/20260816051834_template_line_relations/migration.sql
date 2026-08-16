-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JournalEntryTemplateLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "partnerId" TEXT,
    "taxCategoryId" TEXT,
    "amountDefault" INTEGER,
    "description" TEXT,
    CONSTRAINT "JournalEntryTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "JournalEntryTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalEntryTemplateLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "JournalEntryTemplateLine_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "JournalEntryTemplateLine_taxCategoryId_fkey" FOREIGN KEY ("taxCategoryId") REFERENCES "TaxCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_JournalEntryTemplateLine" ("accountId", "amountDefault", "description", "id", "lineNumber", "partnerId", "side", "taxCategoryId", "templateId") SELECT "accountId", "amountDefault", "description", "id", "lineNumber", "partnerId", "side", "taxCategoryId", "templateId" FROM "JournalEntryTemplateLine";
DROP TABLE "JournalEntryTemplateLine";
ALTER TABLE "new_JournalEntryTemplateLine" RENAME TO "JournalEntryTemplateLine";
CREATE INDEX "JournalEntryTemplateLine_templateId_idx" ON "JournalEntryTemplateLine"("templateId");
CREATE INDEX "JournalEntryTemplateLine_accountId_idx" ON "JournalEntryTemplateLine"("accountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
