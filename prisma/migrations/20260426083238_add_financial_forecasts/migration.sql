-- CreateEnum
CREATE TYPE "ForecastStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "ForecastHorizon" AS ENUM ('NEXT_MONTH', 'NEXT_QUARTER', 'NEXT_YEAR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ForecastPeriodUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR');

-- CreateEnum
CREATE TYPE "ForecastScenario" AS ENUM ('CONSERVATIVE', 'BASE', 'OPTIMISTIC');

-- CreateEnum
CREATE TYPE "ForecastIssueType" AS ENUM ('DATA_QUALITY', 'MISSING_VALUE', 'INVALID_DATE', 'INVALID_NUMBER', 'DUPLICATE_ROW', 'OUTLIER', 'TREND_BREAK', 'INSUFFICIENT_HISTORY', 'MODEL_WARNING', 'CRITICAL_ERROR');

-- CreateEnum
CREATE TYPE "ForecastIssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "ForecastRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "analysisId" TEXT,
    "status" "ForecastStatus" NOT NULL DEFAULT 'PENDING',
    "horizon" "ForecastHorizon" NOT NULL,
    "customPeriods" INTEGER,
    "periodUnit" "ForecastPeriodUnit",
    "targetMetric" TEXT,
    "scenario" "ForecastScenario" NOT NULL DEFAULT 'BASE',
    "inputSummary" JSONB,
    "baselineJson" JSONB,
    "resultJson" JSONB,
    "resultText" TEXT,
    "errorMessage" TEXT,
    "modelName" TEXT,
    "promptVersion" TEXT NOT NULL DEFAULT 'forecast-v1',
    "tokenUsage" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForecastRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastPoint" (
    "id" TEXT NOT NULL,
    "forecastRunId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "metricKey" TEXT NOT NULL,
    "metricLabel" TEXT,
    "predictedValue" DECIMAL(20,4),
    "lowerBound" DECIMAL(20,4),
    "upperBound" DECIMAL(20,4),
    "confidence" DECIMAL(5,2),
    "scenario" "ForecastScenario" NOT NULL DEFAULT 'BASE',
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastIssue" (
    "id" TEXT NOT NULL,
    "forecastRunId" TEXT NOT NULL,
    "type" "ForecastIssueType" NOT NULL,
    "severity" "ForecastIssueSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT,
    "rowReference" TEXT,
    "fieldReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForecastRun_userId_uploadId_idx" ON "ForecastRun"("userId", "uploadId");

-- CreateIndex
CREATE INDEX "ForecastRun_status_idx" ON "ForecastRun"("status");

-- CreateIndex
CREATE INDEX "ForecastRun_createdAt_idx" ON "ForecastRun"("createdAt");

-- CreateIndex
CREATE INDEX "ForecastPoint_forecastRunId_idx" ON "ForecastPoint"("forecastRunId");

-- CreateIndex
CREATE INDEX "ForecastPoint_metricKey_idx" ON "ForecastPoint"("metricKey");

-- CreateIndex
CREATE INDEX "ForecastPoint_period_idx" ON "ForecastPoint"("period");

-- CreateIndex
CREATE INDEX "ForecastIssue_forecastRunId_idx" ON "ForecastIssue"("forecastRunId");

-- CreateIndex
CREATE INDEX "ForecastIssue_severity_idx" ON "ForecastIssue"("severity");

-- AddForeignKey
ALTER TABLE "ForecastRun" ADD CONSTRAINT "ForecastRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastRun" ADD CONSTRAINT "ForecastRun_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "UploadedFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastRun" ADD CONSTRAINT "ForecastRun_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AiAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastPoint" ADD CONSTRAINT "ForecastPoint_forecastRunId_fkey" FOREIGN KEY ("forecastRunId") REFERENCES "ForecastRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastIssue" ADD CONSTRAINT "ForecastIssue_forecastRunId_fkey" FOREIGN KEY ("forecastRunId") REFERENCES "ForecastRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
