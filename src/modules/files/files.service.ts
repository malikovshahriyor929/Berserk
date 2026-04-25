import fs from "node:fs/promises";
import path from "node:path";
import type { Express } from "express";
import { prisma } from "../../config/prisma.js";
import { UploadStatus } from "../../generated/prisma/enums.js";
import { ApiError } from "../../utils/api-error.js";
import { sha256File } from "../../utils/hash.js";
import excelParserService from "./excel-parser.service.js";
import etlService from "./etl.service.js";

class FilesService {
  async uploadFile(userId: string, file: Express.Multer.File) {
    const checksum = await sha256File(file.path);
    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        userId,
        originalName: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        extension: path.extname(file.originalname).replace(".", "").toLowerCase(),
        sizeBytes: file.size,
        checksum,
        rawFilePath: file.path,
        status: UploadStatus.UPLOADED,
      },
    });

    try {
      const sheets = excelParserService.parseFile(file.path);
      const stats = await etlService.persistParsedWorkbook({
        userId,
        uploadId: uploadedFile.id,
        sheets,
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: "file.uploaded",
          entityType: "UploadedFile",
          entityId: uploadedFile.id,
          metadata: stats,
        },
      });

      const currentUpload = await this.getFileById(userId, uploadedFile.id);

      return {
        upload: currentUpload,
        stats,
      };
    } catch (error) {
      await prisma.uploadedFile.update({
        where: { id: uploadedFile.id },
        data: {
          status: UploadStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : "Unknown parsing error",
        },
      });

      throw error;
    }
  }

  async listFiles(userId: string) {
    const uploads = await prisma.uploadedFile.findMany({
      where: { userId },
      orderBy: { uploadedAt: "desc" },
      include: {
        sheets: {
          select: { id: true, sheetName: true, rowCount: true, columnCount: true },
        },
        analyses: {
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        reports: {
          select: { id: true, title: true, generatedAt: true },
        },
        _count: {
          select: {
            attributes: true,
            reports: true,
            analyses: true,
            sheets: true,
          },
        },
      },
    });

    return uploads;
  }

  async getFileById(userId: string, id: string) {
    const upload = await prisma.uploadedFile.findFirst({
      where: { id, userId },
      include: {
        sheets: true,
        analyses: true,
        reports: {
          select: {
            id: true,
            title: true,
            generatedAt: true,
            mimeType: true,
            sizeBytes: true,
          },
        },
        _count: {
          select: {
            rows: true,
            attributes: true,
          },
        },
      },
    });

    if (!upload) {
      throw ApiError.notFound("Uploaded file not found");
    }

    return upload;
  }

  async deleteFile(userId: string, id: string) {
    const upload = await prisma.uploadedFile.findFirst({
      where: { id, userId },
    });

    if (!upload) {
      throw ApiError.notFound("Uploaded file not found");
    }

    await prisma.uploadedFile.delete({
      where: { id: upload.id },
    });

    if (upload.rawFilePath) {
      await fs.unlink(upload.rawFilePath).catch(() => undefined);
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: "file.deleted",
        entityType: "UploadedFile",
        entityId: upload.id,
      },
    });

    return { success: true };
  }
}

export default new FilesService();
