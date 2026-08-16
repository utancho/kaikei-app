-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetAccountId" TEXT NOT NULL,
    "expenseAccountId" TEXT NOT NULL,
    "acquisitionDate" DATETIME NOT NULL,
    "acquisitionCost" INTEGER NOT NULL,
    "residualValue" INTEGER NOT NULL DEFAULT 1,
    "usefulLifeYears" INTEGER NOT NULL,
    "depreciationMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "disposedDate" DATETIME,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FixedAsset_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FixedAssetDepreciation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fixedAssetId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "journalEntryId" TEXT,
    "postedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FixedAssetDepreciation_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntryTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalEntryTemplate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntryTemplateLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "partnerId" TEXT,
    "taxCategoryId" TEXT,
    "amountDefault" INTEGER,
    "description" TEXT,
    CONSTRAINT "JournalEntryTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "JournalEntryTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "representativeName" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "taxationType" TEXT NOT NULL DEFAULT 'EXEMPT',
    "blueReturnDeduction" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Business" ("address", "createdAt", "fiscalYearStartMonth", "id", "name", "postalCode", "representativeName", "taxationType", "type", "updatedAt") SELECT "address", "createdAt", "fiscalYearStartMonth", "id", "name", "postalCode", "representativeName", "taxationType", "type", "updatedAt" FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FixedAsset_businessId_idx" ON "FixedAsset"("businessId");

-- CreateIndex
CREATE INDEX "FixedAssetDepreciation_fixedAssetId_idx" ON "FixedAssetDepreciation"("fixedAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAssetDepreciation_fixedAssetId_fiscalYearId_key" ON "FixedAssetDepreciation"("fixedAssetId", "fiscalYearId");

-- CreateIndex
CREATE INDEX "JournalEntryTemplate_businessId_idx" ON "JournalEntryTemplate"("businessId");

-- CreateIndex
CREATE INDEX "JournalEntryTemplateLine_templateId_idx" ON "JournalEntryTemplateLine"("templateId");
