-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('UPLOADED', 'PARSING', 'PARSED', 'ANALYZING', 'ANALYZED', 'PDF_GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "AttributeDataType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'CURRENCY', 'PERCENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AiAnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- DropForeignKey
ALTER TABLE "AuthorProfile" DROP CONSTRAINT "AuthorProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "Book" DROP CONSTRAINT "Book_authorId_fkey";

-- DropForeignKey
ALTER TABLE "BookAccess" DROP CONSTRAINT "BookAccess_bookId_fkey";

-- DropForeignKey
ALTER TABLE "BookAccess" DROP CONSTRAINT "BookAccess_orderId_fkey";

-- DropForeignKey
ALTER TABLE "BookAccess" DROP CONSTRAINT "BookAccess_userId_fkey";

-- DropForeignKey
ALTER TABLE "BookTag" DROP CONSTRAINT "BookTag_bookId_fkey";

-- DropForeignKey
ALTER TABLE "BookTag" DROP CONSTRAINT "BookTag_tagId_fkey";

-- DropForeignKey
ALTER TABLE "Chapter" DROP CONSTRAINT "Chapter_bookId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_bookId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";

-- DropForeignKey
ALTER TABLE "ReadingProgress" DROP CONSTRAINT "ReadingProgress_chapterId_fkey";

-- DropForeignKey
ALTER TABLE "ReadingProgress" DROP CONSTRAINT "ReadingProgress_userId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_bookId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_userId_fkey";

-- DropForeignKey
ALTER TABLE "Save" DROP CONSTRAINT "Save_bookId_fkey";

-- DropForeignKey
ALTER TABLE "Save" DROP CONSTRAINT "Save_userId_fkey";

-- AlterTable
ALTER TABLE "Token" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "balanceCents",
DROP COLUMN "saveCount",
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "AuthorProfile";

-- DropTable
DROP TABLE "Book";

-- DropTable
DROP TABLE "BookAccess";

-- DropTable
DROP TABLE "BookTag";

-- DropTable
DROP TABLE "Chapter";

-- DropTable
DROP TABLE "Order";

-- DropTable
DROP TABLE "ReadingProgress";

-- DropTable
DROP TABLE "Review";

-- DropTable
DROP TABLE "Save";

-- DropTable
DROP TABLE "Tag";

-- DropEnum
DROP TYPE "AccessType";

-- DropEnum
DROP TYPE "BookStatus";

-- DropEnum
DROP TYPE "BookVisibility";

-- DropEnum
DROP TYPE "Monetization";

-- DropEnum
DROP TYPE "OrderStatus";

-- DropEnum
DROP TYPE "OrderType";

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT,
    "mimeType" TEXT,
    "extension" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "status" "UploadStatus" NOT NULL DEFAULT 'UPLOADED',
    "errorMessage" TEXT,
    "rawFilePath" TEXT,
    "rawFileData" BYTEA,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parsedAt" TIMESTAMP(3),
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParsedSheet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "detectedRange" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "columnCount" INTEGER NOT NULL DEFAULT 0,
    "headerRowIndex" INTEGER,
    "headers" JSONB,
    "rawRows" JSONB,
    "normalizedRows" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParsedSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedRow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "rowIdentityHash" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "normalizedJson" JSONB,
    "detectedDate" TIMESTAMP(3),
    "detectedAmount" DECIMAL(20,4),
    "detectedType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAttribute" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "sheetId" TEXT,
    "rowId" TEXT,
    "identityKey" TEXT NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dataType" "AttributeDataType" NOT NULL DEFAULT 'UNKNOWN',
    "sheetName" TEXT,
    "rowIndex" INTEGER,
    "columnIndex" INTEGER,
    "periodDate" TIMESTAMP(3),
    "latestVersionId" TEXT,
    "currentValueRaw" TEXT,
    "currentValueText" TEXT,
    "currentValueNumber" DECIMAL(20,4),
    "currentValueDate" TIMESTAMP(3),
    "currentValueJson" JSONB,
    "rowIdentityHash" TEXT,
    "attributeHash" TEXT,
    "versionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeVersion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceUploadId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "valueRaw" TEXT,
    "valueText" TEXT,
    "valueNumber" DECIMAL(20,4),
    "valueDate" TIMESTAMP(3),
    "valueJson" JSONB,
    "valueHash" TEXT NOT NULL,
    "periodDate" TIMESTAMP(3),
    "sourceSheetName" TEXT,
    "sourceRowIndex" INTEGER,
    "sourceColumnIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "status" "AiAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "modelName" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "inputSummary" JSONB,
    "requestPayload" JSONB,
    "resultJson" JSONB,
    "resultText" TEXT,
    "errorMessage" TEXT,
    "tokenUsage" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "templateJson" JSONB NOT NULL,
    "htmlTemplate" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadId" TEXT,
    "analysisId" TEXT,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "pdfData" BYTEA NOT NULL,
    "reportJson" JSONB,
    "range" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadedFile_userId_uploadedAt_idx" ON "UploadedFile"("userId", "uploadedAt");

-- CreateIndex
CREATE INDEX "UploadedFile_status_idx" ON "UploadedFile"("status");

-- CreateIndex
CREATE INDEX "ParsedSheet_userId_uploadId_idx" ON "ParsedSheet"("userId", "uploadId");

-- CreateIndex
CREATE INDEX "ParsedSheet_sheetName_idx" ON "ParsedSheet"("sheetName");

-- CreateIndex
CREATE INDEX "ExtractedRow_userId_uploadId_idx" ON "ExtractedRow"("userId", "uploadId");

-- CreateIndex
CREATE INDEX "ExtractedRow_rowIdentityHash_idx" ON "ExtractedRow"("rowIdentityHash");

-- CreateIndex
CREATE INDEX "FinancialAttribute_userId_attributeKey_idx" ON "FinancialAttribute"("userId", "attributeKey");

-- CreateIndex
CREATE INDEX "FinancialAttribute_userId_uploadId_idx" ON "FinancialAttribute"("userId", "uploadId");

-- CreateIndex
CREATE INDEX "FinancialAttribute_rowIdentityHash_idx" ON "FinancialAttribute"("rowIdentityHash");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAttribute_userId_identityKey_key" ON "FinancialAttribute"("userId", "identityKey");

-- CreateIndex
CREATE INDEX "AttributeVersion_userId_sourceUploadId_idx" ON "AttributeVersion"("userId", "sourceUploadId");

-- CreateIndex
CREATE INDEX "AttributeVersion_attributeId_isLatest_idx" ON "AttributeVersion"("attributeId", "isLatest");

-- CreateIndex
CREATE INDEX "AttributeVersion_valueHash_idx" ON "AttributeVersion"("valueHash");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeVersion_attributeId_versionNo_key" ON "AttributeVersion"("attributeId", "versionNo");

-- CreateIndex
CREATE INDEX "AiAnalysis_userId_uploadId_idx" ON "AiAnalysis"("userId", "uploadId");

-- CreateIndex
CREATE INDEX "AiAnalysis_status_idx" ON "AiAnalysis"("status");

-- CreateIndex
CREATE INDEX "ReportTemplate_userId_idx" ON "ReportTemplate"("userId");

-- CreateIndex
CREATE INDEX "GeneratedReport_userId_generatedAt_idx" ON "GeneratedReport"("userId", "generatedAt");

-- CreateIndex
CREATE INDEX "GeneratedReport_uploadId_idx" ON "GeneratedReport"("uploadId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "Token_expiresAt_idx" ON "Token"("expiresAt");

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParsedSheet" ADD CONSTRAINT "ParsedSheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParsedSheet" ADD CONSTRAINT "ParsedSheet_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "UploadedFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedRow" ADD CONSTRAINT "ExtractedRow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedRow" ADD CONSTRAINT "ExtractedRow_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "UploadedFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedRow" ADD CONSTRAINT "ExtractedRow_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "ParsedSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAttribute" ADD CONSTRAINT "FinancialAttribute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAttribute" ADD CONSTRAINT "FinancialAttribute_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "UploadedFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAttribute" ADD CONSTRAINT "FinancialAttribute_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "ParsedSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAttribute" ADD CONSTRAINT "FinancialAttribute_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "ExtractedRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeVersion" ADD CONSTRAINT "AttributeVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeVersion" ADD CONSTRAINT "AttributeVersion_sourceUploadId_fkey" FOREIGN KEY ("sourceUploadId") REFERENCES "UploadedFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeVersion" ADD CONSTRAINT "AttributeVersion_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "FinancialAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "UploadedFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AiAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReportTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
