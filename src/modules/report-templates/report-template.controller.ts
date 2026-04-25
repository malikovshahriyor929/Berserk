import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import reportTemplateService from "./report-template.service.js";

type TemplateUpdateInput = {
  name?: string | undefined;
  description?: string | undefined;
  templateJson?: unknown;
  htmlTemplate?: string | null | undefined;
  isDefault?: boolean | undefined;
};

const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  templateJson: z.unknown(),
  htmlTemplate: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
});

const updateTemplateSchema = templateSchema.partial();

class ReportTemplateController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const payload = templateSchema.parse(req.body);
    const result = await reportTemplateService.create(userId, payload);
    res.status(201).json(result);
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const result = await reportTemplateService.list(userId);
    res.status(200).json(result);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const result = await reportTemplateService.getById(userId, params.id);
    res.status(200).json(result);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const payload = updateTemplateSchema.parse(req.body) as TemplateUpdateInput;
    const result = await reportTemplateService.update(userId, params.id, payload);
    res.status(200).json(result);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const result = await reportTemplateService.delete(userId, params.id);
    res.status(200).json(result);
  });
}

export default new ReportTemplateController();
