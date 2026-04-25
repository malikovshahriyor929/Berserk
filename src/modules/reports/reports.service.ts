import reportTemplateService from "../report-templates/report-template.service.js";
import pdfService from "./pdf.service.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { UploadStatus, AiAnalysisStatus } from "../../generated/prisma/enums.js";
import { toJsonValue } from "../../utils/json.js";

type ReportMetadataRecord = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadId: string | null;
  analysisId: string | null;
  templateId: string | null;
  range: string | null;
  generatedAt: Date;
};

type GeneratePdfReportParams = {
  userId: string;
  uploadId: string;
  analysisId: string;
  templateId?: string | null;
  range?: string | null;
};

function sanitizeFileName(input: string) {
  return input
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "report";
}

class ReportsService {
  toReportMetadata(report: ReportMetadataRecord) {
    return {
      id: report.id,
      title: report.title,
      fileName: report.fileName,
      mimeType: report.mimeType,
      sizeBytes: report.sizeBytes,
      uploadId: report.uploadId,
      analysisId: report.analysisId,
      templateId: report.templateId,
      range: report.range ?? "all",
      generatedAt: report.generatedAt,
      downloadUrl: `/api/reports/${report.id}/download`,
    };
  }

  async generatePdfReportFromAnalysis(params: GeneratePdfReportParams) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        name: true,
        fullName: true,
        email: true,
      },
    });

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    const upload = await prisma.uploadedFile.findFirst({
      where: {
        id: params.uploadId,
        userId: params.userId,
      },
    });

    if (!upload) {
      throw ApiError.notFound("Uploaded file not found");
    }

    const analysis = await prisma.aiAnalysis.findFirst({
      where: {
        id: params.analysisId,
        uploadId: params.uploadId,
        userId: params.userId,
      },
    });

    if (!analysis) {
      throw ApiError.notFound("Analysis not found");
    }

    if (analysis.status !== AiAnalysisStatus.SUCCESS) {
      throw ApiError.badRequest("PDF report can only be generated for successful analyses");
    }

    const existing = await prisma.generatedReport.findFirst({
      where: {
        userId: params.userId,
        analysisId: params.analysisId,
      },
      orderBy: {
        generatedAt: "desc",
      },
      select: {
        id: true,
        title: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        uploadId: true,
        analysisId: true,
        templateId: true,
        range: true,
        generatedAt: true,
      },
    });

    if (existing) {
      return this.toReportMetadata(existing);
    }

    const template = params.templateId
      ? await reportTemplateService.getById(params.userId, params.templateId)
      : await reportTemplateService.getDefaultTemplate(params.userId);

    const attributes = await prisma.financialAttribute.findMany({
      where: {
        userId: params.userId,
        uploadId: params.uploadId,
      },
      orderBy: [
        { updatedAt: "desc" },
        { rowIndex: "asc" },
      ],
      take: 200,
    });

    const title = `Moliyaviy hisobot - ${upload.originalName}`;
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `financial-report-${sanitizeFileName(upload.originalName)}-${stamp}.pdf`;

    const generatedAt = new Date();

    const reportJson = {
      upload: {
        id: upload.id,
        originalName: upload.originalName,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        status: upload.status,
        uploadedAt: upload.uploadedAt,
      },
      analysis: {
        id: analysis.id,
        status: analysis.status,
        modelName: analysis.modelName,
        promptVersion: analysis.promptVersion,
        resultJson: analysis.resultJson,
        resultText: analysis.resultText,
        completedAt: analysis.completedAt,
      },
      template: template
        ? {
            id: template.id,
            name: template.name,
            description: template.description,
          }
        : null,
      attributes: attributes.map((attribute) => ({
        id: attribute.id,
        key: attribute.attributeKey,
        label: attribute.label,
        dataType: attribute.dataType,
        rowIndex: attribute.rowIndex,
        sheetName: attribute.sheetName,
        latestValueNumber: attribute.currentValueNumber,
        latestValueText: attribute.currentValueText,
        latestValueDate: attribute.currentValueDate,
        versionCount: attribute.versionCount,
      })),
      generatedAt: generatedAt.toISOString(),
      user: {
        name: user.name,
        fullName: user.fullName,
        email: user.email,
      },
    };

    const pdfBuffer = await pdfService.createFinancialReportPdf({
      title,
      upload,
      analysis,
      attributes,
      template,
      generatedAt,
      user,
    });

    const report = await prisma.generatedReport.create({
      data: {
        userId: params.userId,
        uploadId: params.uploadId,
        analysisId: params.analysisId,
        ...(template ? { templateId: template.id } : {}),
        title,
        fileName,
        mimeType: "application/pdf",
        sizeBytes: pdfBuffer.byteLength,
        pdfData: new Uint8Array(pdfBuffer),
        reportJson: toJsonValue(reportJson),
        range: params.range ?? "all",
        generatedAt,
      },
      select: {
        id: true,
        title: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        uploadId: true,
        analysisId: true,
        templateId: true,
        range: true,
        generatedAt: true,
      },
    });

    await prisma.uploadedFile.update({
      where: { id: params.uploadId },
      data: {
        status: UploadStatus.PDF_GENERATED,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: "report.generated",
        entityType: "GeneratedReport",
        entityId: report.id,
        metadata: toJsonValue({
          uploadId: params.uploadId,
          analysisId: params.analysisId,
        }),
      },
    }).catch(() => undefined);

    return this.toReportMetadata(report);
  }

  async generate(userId: string, input: {
    templateId?: string | null | undefined;
    uploadId?: string | undefined;
    analysisId?: string | undefined;
    range?: string | undefined;
  }) {
    let uploadId = input.uploadId ?? null;
    let analysisId = input.analysisId ?? null;

    if (!uploadId && analysisId) {
      const analysis = await prisma.aiAnalysis.findFirst({
        where: { id: analysisId, userId },
      });
      if (!analysis) {
        throw ApiError.notFound("Analysis not found");
      }
      uploadId = analysis.uploadId;
    }

    if (!analysisId && uploadId) {
      const analysis = await prisma.aiAnalysis.findFirst({
        where: { uploadId, userId, status: AiAnalysisStatus.SUCCESS },
        orderBy: { createdAt: "desc" },
      });
      if (!analysis) {
        throw ApiError.notFound("Successful analysis not found");
      }
      analysisId = analysis.id;
    }

    if (!uploadId || !analysisId) {
      throw ApiError.badRequest("uploadId and analysisId could not be resolved");
    }

    return this.generatePdfReportFromAnalysis({
      userId,
      uploadId,
      analysisId,
      templateId: input.templateId ?? null,
      range: input.range ?? "all",
    });
  }

  async list(userId: string) {
    const reports = await prisma.generatedReport.findMany({
      where: { userId },
      orderBy: { generatedAt: "desc" },
      select: {
        id: true,
        title: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        generatedAt: true,
        range: true,
        uploadId: true,
        analysisId: true,
        templateId: true,
      },
    });

    return reports.map((report) => this.toReportMetadata(report));
  }

  async getById(userId: string, id: string) {
    const report = await prisma.generatedReport.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        generatedAt: true,
        range: true,
        uploadId: true,
        analysisId: true,
        templateId: true,
        userId: true,
      },
    });

    if (!report) {
      throw ApiError.notFound("Report not found");
    }

    if (report.userId !== userId) {
      throw ApiError.forbidden("Forbidden");
    }

    return this.toReportMetadata(report);
  }

  async download(userId: string, id: string) {
    const report = await prisma.generatedReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw ApiError.notFound("Report not found");
    }

    if (report.userId !== userId) {
      throw ApiError.forbidden("Forbidden");
    }

    return report;
  }
}

export default new ReportsService();
