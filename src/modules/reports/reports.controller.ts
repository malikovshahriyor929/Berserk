import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import reportsService from "./reports.service.js";

const generateReportSchema = z.object({
  templateId: z.string().nullable().optional(),
  uploadId: z.string().optional(),
  analysisId: z.string().optional(),
  range: z.string().default("all"),
});

class ReportsController {
  generate = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const payload = generateReportSchema.parse(req.body);
    const result = await reportsService.generate(userId, payload);
    res.status(201).json(result);
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const result = await reportsService.list(userId);
    res.status(200).json(result);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const result = await reportsService.getById(userId, params.id);
    res.status(200).json(result);
  });

  download = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const report = await reportsService.download(userId, params.id);

    res.setHeader("Content-Type", report.mimeType || "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(report.fileName)}"`,
    );
    res.setHeader("Content-Length", report.sizeBytes.toString());
    res.status(200).send(Buffer.from(report.pdfData));
  });
}

export default new ReportsController();
