import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { toJsonValue } from "../../utils/json.js";
import preprocessor from "./forecast-preprocessor.service.js";
import aiService from "./forecast-ai.service.js";
import type { ForecastRunDto } from "./forecast-types.js";
import type { ForecastStatus } from "../../generated/prisma/client.js";

class ForecastsService {
  async runForecast(userId: string, dto: ForecastRunDto) {
    const upload = await prisma.uploadedFile.findFirst({
      where: { id: dto.uploadId, userId },
    });

    if (!upload) {
      throw ApiError.notFound("Uploaded file not found");
    }

    // Create record
    const run = await prisma.forecastRun.create({
      data: {
        userId,
        uploadId: dto.uploadId,
        analysisId: dto.analysisId || null,
        status: "RUNNING" as ForecastStatus,
        horizon: dto.horizon,
        customPeriods: dto.customPeriods || null,
        periodUnit: dto.periodUnit || null,
        targetMetric: dto.targetMetric || null,
        scenario: dto.scenario || "BASE",
        startedAt: new Date(),
      },
    });

    try {
      // 1. Preprocess
      const preData = await preprocessor.prepareData(userId, dto.uploadId);
      
      if (!preData.readiness.canForecast) {
        return await this.handleInsufficientData(run.id, preData);
      }

      // 2. AI Forecast
      const aiResult = await aiService.runForecast({
        metadata: {
          filename: upload.originalName,
          uploadedAt: upload.uploadedAt,
        },
        ...preData,
        horizon: dto.horizon,
        scenario: dto.scenario || "BASE",
        targetMetric: dto.targetMetric,
      });

      const normalized = aiResult.normalized;

      // 3. Save Points & Issues
      await prisma.$transaction([
        prisma.forecastPoint.createMany({
          data: normalized.forecastPoints.map(p => ({
            forecastRunId: run.id,
            period: p.period,
            metricKey: p.metricKey,
            metricLabel: p.metricLabel || null,
            predictedValue: p.predictedValue,
            lowerBound: p.lowerBound ?? null,
            upperBound: p.upperBound ?? null,
            confidence: p.confidence ?? null,
            scenario: p.scenario || "BASE",
            explanation: p.explanation || null,
          })),
        }),
        prisma.forecastIssue.createMany({
          data: [
            ...preData.dataQualityIssues,
            ...normalized.warnings,
            ...normalized.errors,
          ].map(issue => ({
            forecastRunId: run.id,
            type: issue.type,
            severity: issue.severity,
            title: issue.title,
            description: issue.description,
            recommendation: issue.recommendation || null,
            rowReference: issue.rowReference || null,
            fieldReference: issue.fieldReference || null,
          })),
        }),
        prisma.forecastRun.update({
          where: { id: run.id },
          data: {
            status: normalized.status === "INSUFFICIENT_DATA" ? "INSUFFICIENT_DATA" : "SUCCESS",
            inputSummary: toJsonValue(preData.summaryForAi),
            baselineJson: toJsonValue(preData.baselineForecast),
            resultJson: toJsonValue(normalized),
            resultText: normalized.summary,
            tokenUsage: toJsonValue(aiResult.tokenUsage),
            completedAt: new Date(),
          },
        }),
      ]);

      return this.getById(userId, run.id);
    } catch (error) {
      console.error("Forecast execution failed:", error);
      const message = error instanceof Error ? error.message : "Internal forecast error";
      
      await prisma.forecastRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          errorMessage: message,
          completedAt: new Date(),
        },
      });

      throw new ApiError(500, message);
    }
  }

  private async handleInsufficientData(runId: string, preData: any) {
    await prisma.$transaction([
      prisma.forecastIssue.createMany({
        data: preData.dataQualityIssues.map((issue: any) => ({
          forecastRunId: runId,
          type: issue.type,
          severity: issue.severity,
          title: issue.title,
          description: issue.description,
          recommendation: issue.recommendation,
        })),
      }),
      prisma.forecastRun.update({
        where: { id: runId },
        data: {
          status: "INSUFFICIENT_DATA",
          errorMessage: preData.readiness.reason,
          completedAt: new Date(),
        },
      }),
    ]);

    return prisma.forecastRun.findUnique({
      where: { id: runId },
      include: { issues: true },
    });
  }

  async list(userId: string) {
    return prisma.forecastRun.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        upload: {
          select: { originalName: true },
        },
        _count: {
          select: { points: true, issues: true },
        },
      },
    });
  }

  async getById(userId: string, id: string) {
    const run = await prisma.forecastRun.findFirst({
      where: { id, userId },
      include: {
        upload: {
          select: { originalName: true, uploadedAt: true },
        },
        points: { orderBy: { period: "asc" } },
        issues: { orderBy: { severity: "desc" } },
      },
    });

    if (!run) throw ApiError.notFound("Forecast not found");
    return run;
  }

  async delete(userId: string, id: string) {
    await this.getById(userId, id);
    return prisma.forecastRun.delete({ where: { id } });
  }

  async getReadiness(userId: string, uploadId: string) {
    return preprocessor.prepareData(userId, uploadId);
  }
}

export default new ForecastsService();
