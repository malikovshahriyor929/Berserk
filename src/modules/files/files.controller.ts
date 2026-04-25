import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import filesService from "./files.service.js";

class FilesController {
  upload = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    if (!req.file) {
      throw ApiError.badRequest("file is required");
    }

    const result = await filesService.uploadFile(userId, req.file);
    res.status(201).json(result);
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const result = await filesService.listFiles(userId);
    res.status(200).json(result);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const result = await filesService.getFileById(userId, params.id);
    res.status(200).json(result);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const result = await filesService.deleteFile(userId, params.id);
    res.status(200).json(result);
  });
}

export default new FilesController();
