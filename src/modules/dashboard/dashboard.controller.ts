import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { rangeSchema } from "../../utils/date-range.js";
import dashboardService from "./dashboard.service.js";

class DashboardController {
  summary = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const query = z.object({ range: rangeSchema.optional() }).parse(req.query);
    const result = await dashboardService.getSummary(userId, query.range ?? "1m");
    res.status(200).json(result);
  });

  charts = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const query = z.object({ range: rangeSchema.optional() }).parse(req.query);
    const result = await dashboardService.getCharts(userId, query.range ?? "1m");
    res.status(200).json(result);
  });

  uploads = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const query = z.object({ limit: z.coerce.number().int().positive().max(100).default(10) }).parse(req.query);
    const result = await dashboardService.getRecentUploads(userId, query.limit);
    res.status(200).json(result);
  });

  reports = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const query = z.object({ limit: z.coerce.number().int().positive().max(100).default(10) }).parse(req.query);
    const result = await dashboardService.getRecentReports(userId, query.limit);
    res.status(200).json(result);
  });
}

export default new DashboardController();
