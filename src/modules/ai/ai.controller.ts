import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import aiService from "./ai.service.js";

class AiController {
  run = asyncHandler(async (req: Request, res: Response) => {
    // Increase timeout for AI analysis (10 minutes)
    res.setTimeout(10 * 60 * 1000);
    
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const params = z.object({ uploadId: z.string().min(1) }).parse(req.params);
    const result = await aiService.runAnalysis(userId, params.uploadId);
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const query = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(10),
    }).parse(req.query);

    const result = await aiService.list(userId, query.page, query.limit);
    res.status(200).json(result);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const result = await aiService.getById(userId, params.id);
    res.status(200).json(result);
  });
}

export default new AiController();
