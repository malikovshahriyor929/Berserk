import type e from "express";
import path from "node:path";
import BaseError from "../errors/auth.errors.js";
import { prisma } from "../services/prisma.js";
import { BookStatus } from "../generated/prisma/enums.js";

class GlobalController {
  async profile(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const userId = req.user?.id as string | undefined;

      if (!userId) {
        return next(BaseError.UnauthorizedError());
      }
      const result = await prisma.user.findUnique({
        where: { id: userId },
      });
      return res.status(200).json(result);
    } catch (error) {
      next(
        BaseError.badRequest(
          "Get books failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }

  async lookupBooks(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const categoryRaw = req.query.category ?? req.params.category;
      const statusRaw = req.query.status ?? req.params.status;
      const category = categoryRaw ? String(categoryRaw) : undefined;
      const status = statusRaw ? String(statusRaw) : undefined;

      const where: {
        category?: { equals: string; mode: "insensitive" };
        status?: BookStatus;
      } = {};

      if (category) {
        where.category = { equals: String(category), mode: "insensitive" };
      }

      if (status) {
        const normalizedStatus = String(status).toUpperCase() as BookStatus;
        const validStatuses = Object.values(BookStatus);

        if (!validStatuses.includes(normalizedStatus)) {
          throw new Error(
            `Invalid status. Allowed values: ${validStatuses.join(", ")}`,
          );
        }

        where.status = normalizedStatus;
      }

      const result = await prisma.book.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
        },
      });

      const options = result.map((book) => ({
        label: book.title,
        value: book.id,
      }));

      return res.status(200).json({
        message: "Books lookup success",
        data: {
          category: options,
          // language: lang
        },
      });
    } catch (error) {
      next(
        BaseError.badRequest(
          "Lookup failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
  async upload(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const userId = req.user?.id as string | undefined;

      if (!userId) {
        return next(BaseError.UnauthorizedError());
      }

      const file = req.file;

      if (!file) {
        return next(BaseError.badRequest("Upload failed", "file is required"));
      }

      const extantion = path.extname(file.originalname || file.filename || "")
        .replace(".", "")
        .toLowerCase();
      const publicId = path.parse(file.filename).name;
      const url = `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;

      return res.status(201).json({
        public_id: publicId,
        file_size: file.size,
        extantion,
        url,
      });
    } catch (error) {
      next(
        BaseError.badRequest(
          "Upload failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
}

export default new GlobalController();
