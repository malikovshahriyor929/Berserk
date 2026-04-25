import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import mime from "mime-types";
import type { Request } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

const uploadsDir = path.resolve(process.cwd(), "uploads");
const allowedExtensions = new Set([".xlsx", ".xls", ".csv"]);
const allowedMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "text/plain",
]);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) => cb(null, uploadsDir),
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${extension}`);
  },
});

export const uploadSingleFile = multer({
  storage,
  limits: {
    fileSize: env.UPLOAD_MAX_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const detectedMime = file.mimetype || mime.lookup(extension) || "";

    if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(String(detectedMime))) {
      cb(ApiError.badRequest("Only .xlsx, .xls, and .csv files are allowed"));
      return;
    }

    cb(null, true);
  },
}).single("file");
