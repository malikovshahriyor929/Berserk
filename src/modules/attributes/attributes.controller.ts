import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import attributesService from "./attributes.service.js";

class AttributesController {
  palette = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const result = await attributesService.getPalette(userId);
    res.status(200).json(result);
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const result = await attributesService.list(userId);
    res.status(200).json(result);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const result = await attributesService.getById(userId, params.id);
    res.status(200).json(result);
  });

  versions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const result = await attributesService.getVersions(userId, params.id);
    res.status(200).json(result);
  });
}

export default new AttributesController();
