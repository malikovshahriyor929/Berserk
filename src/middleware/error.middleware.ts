import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/api-error.js";
import { env } from "../config/env.js";

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.flatten(),
    });
  }

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      message: error.message,
      errors: error.details ?? null,
    });
  }

  console.error("Unhandled error", error);

  return res.status(500).json({
    message: "Internal server error",
    errors: env.isProduction ? null : String(error),
  });
}
