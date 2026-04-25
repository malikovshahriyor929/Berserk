import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AiAnalysisStatus, UploadStatus } from "../../generated/prisma/enums.js";
import { ApiError } from "../../utils/api-error.js";
import { toJsonValue } from "../../utils/json.js";
import reportsService from "../reports/reports.service.js";
import geminiService from "./gemini.service.js";

type AnalysisRecord = Awaited<ReturnType<typeof prisma.aiAnalysis.findUniqueOrThrow>>;

type AnalysisRunResult = {
  analysis: AnalysisRecord;
  report: ReturnType<typeof reportsService.toReportMetadata> | null;
  warning?: string;
};

class AiService {
  private async buildUploadSummary(userId: string, uploadId: string) {
    const upload = await prisma.uploadedFile.findFirst({
      where: { id: uploadId, userId },
      include: {
        sheets: {
          orderBy: { sheetName: "asc" },
        },
        attributes: {
          orderBy: { updatedAt: "desc" },
          take: 100,
        },
      },
    });

    if (!upload) {
      throw ApiError.notFound("Uploaded file not found");
    }

    return {
      upload: {
        id: upload.id,
        originalName: upload.originalName,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        uploadedAt: upload.uploadedAt,
        status: upload.status,
      },
      sheets: upload.sheets.map((sheet) => ({
        id: sheet.id,
        sheetName: sheet.sheetName,
        detectedRange: sheet.detectedRange,
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount,
        headerRowIndex: sheet.headerRowIndex,
        headers: sheet.headers,
        sampleRows: Array.isArray(sheet.normalizedRows)
          ? (sheet.normalizedRows as unknown[]).slice(0, 5)
          : [],
      })),
      attributes: upload.attributes.slice(0, 100).map((attribute) => ({
        key: attribute.attributeKey,
        label: attribute.label,
        dataType: attribute.dataType,
        sheetName: attribute.sheetName,
        rowIndex: attribute.rowIndex,
        currentValueText: attribute.currentValueText,
        currentValueNumber: attribute.currentValueNumber,
        currentValueDate: attribute.currentValueDate,
        versionCount: attribute.versionCount,
      })),
    };
  }

  async runAnalysis(userId: string, uploadId: string): Promise<AnalysisRunResult> {
    const upload = await prisma.uploadedFile.findFirst({
      where: { id: uploadId, userId },
    });

    if (!upload) {
      throw ApiError.notFound("Uploaded file not found");
    }

    const allowedStatuses: UploadStatus[] = [UploadStatus.PARSED, UploadStatus.ANALYZED, UploadStatus.PDF_GENERATED];
    if (!allowedStatuses.includes(upload.status)) {
      throw ApiError.badRequest("Uploaded file must be parsed before running AI analysis");
    }

    const inputSummary = await this.buildUploadSummary(userId, uploadId);

    const analysis = await prisma.aiAnalysis.create({
      data: {
        userId,
        uploadId,
        status: AiAnalysisStatus.RUNNING,
        modelName: env.VERTEX_AI_MODEL,
        promptVersion: "v1",
        inputSummary: toJsonValue(inputSummary),
        startedAt: new Date(),
      },
    });

    await prisma.uploadedFile.update({
      where: { id: uploadId },
      data: {
        status: UploadStatus.ANALYZING,
        errorMessage: null,
      },
    });

    try {
      const result = await geminiService.analyzeFinancialSummary(inputSummary);

      const updated = await prisma.aiAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: AiAnalysisStatus.SUCCESS,
          modelName: env.VERTEX_AI_MODEL,
          requestPayload: toJsonValue(result.requestPayload),
          resultText: result.responseText || null,
          completedAt: new Date(),
          ...(result.responseJson !== null ? { resultJson: toJsonValue(result.responseJson) } : {}),
          ...(result.tokenUsage !== null ? { tokenUsage: toJsonValue(result.tokenUsage) } : {}),
        },
      });

      await prisma.uploadedFile.update({
        where: { id: uploadId },
        data: {
          status: UploadStatus.ANALYZED,
          analyzedAt: new Date(),
          errorMessage: null,
        },
      });

      try {
        const report = await reportsService.generatePdfReportFromAnalysis({
          userId,
          uploadId,
          analysisId: analysis.id,
          range: "all",
        });

        return {
          analysis: updated,
          report,
        };
      } catch (error) {
        const warning = "Analysis completed, but PDF generation failed";
        const message = error instanceof Error ? error.message : warning;

        await prisma.auditLog.create({
          data: {
            userId,
            action: "report.generation_failed",
            entityType: "AiAnalysis",
            entityId: analysis.id,
            metadata: toJsonValue({
              uploadId,
              message,
            }),
          },
        }).catch(() => undefined);

        return {
          analysis: updated,
          report: null,
          warning,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI analysis failed";

      const updated = await prisma.aiAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: AiAnalysisStatus.FAILED,
          errorMessage: message,
          completedAt: new Date(),
        },
      });

      await prisma.uploadedFile.update({
        where: { id: uploadId },
        data: {
          status: UploadStatus.FAILED,
          errorMessage: message,
        },
      });

      throw new ApiError(500, message, updated);
    }
  }

  async list(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [items, total] = await prisma.$transaction([
      prisma.aiAnalysis.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          upload: {
            select: {
              id: true,
              originalName: true,
            },
          },
        },
      }),
      prisma.aiAnalysis.count({
        where: { userId },
      }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: skip + items.length < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getById(userId: string, id: string) {
    const analysis = await prisma.aiAnalysis.findFirst({
      where: { id, userId },
      include: {
        upload: {
          select: {
            id: true,
            originalName: true,
          },
        },
      },
    });

    if (!analysis) {
      throw ApiError.notFound("Analysis not found");
    }

    return analysis;
  }
}

export default new AiService();
