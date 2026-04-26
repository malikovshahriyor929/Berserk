import type { Request, Response, NextFunction } from "express";
import forecastsService from "./forecasts.service.js";
import type { ForecastRunDto } from "./forecast-types.js";
import { z } from "zod";

const forecastRunSchema = z.object({
  uploadId: z.string().min(1),
  analysisId: z.string().optional(),
  horizon: z.enum(["NEXT_MONTH", "NEXT_QUARTER", "NEXT_YEAR", "CUSTOM"]),
  customPeriods: z.number().optional(),
  periodUnit: z.enum(["DAY", "WEEK", "MONTH", "QUARTER", "YEAR"]).optional(),
  targetMetric: z.string().optional(),
  scenario: z.enum(["CONSERVATIVE", "BASE", "OPTIMISTIC"]).optional(),
});

class ForecastsController {
  async runForecast(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const dto = forecastRunSchema.parse(req.body) as ForecastRunDto;
      
      const result = await forecastsService.runForecast(userId, dto);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const items = await forecastsService.list(userId);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const id = req.params.id;
      if (!id) throw new Error("ID is required");
      const item = await forecastsService.getById(userId, id as string);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const id = req.params.id;
      if (!id) throw new Error("ID is required");
      await forecastsService.delete(userId, id as string);
      res.json({ success: true, message: "Forecast deleted" });
    } catch (error) {
      next(error);
    }
  }

  async getReadiness(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const uploadId = req.params.uploadId;
      if (!uploadId) throw new Error("Upload ID is required");
      const readiness = await forecastsService.getReadiness(userId, uploadId as string);
      res.json({ success: true, data: readiness });
    } catch (error) {
      next(error);
    }
  }
}

export default new ForecastsController();
