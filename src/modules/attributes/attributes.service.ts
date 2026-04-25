import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";

class AttributesService {
  async getPalette(userId: string) {
    const attributes = await prisma.financialAttribute.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        upload: {
          select: {
            id: true,
            originalName: true,
            uploadedAt: true,
          },
        },
      },
    });

    return attributes.map((attribute) => ({
      id: attribute.id,
      key: attribute.attributeKey,
      label: attribute.label,
      type: attribute.dataType,
      latestValue:
        attribute.currentValueNumber ??
        attribute.currentValueText ??
        attribute.currentValueRaw ??
        attribute.currentValueDate,
      versionCount: attribute.versionCount,
      source: {
        uploadId: attribute.upload.id,
        originalName: attribute.upload.originalName,
        uploadedAt: attribute.upload.uploadedAt,
      },
    }));
  }

  async list(userId: string) {
    return prisma.financialAttribute.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getById(userId: string, id: string) {
    const attribute = await prisma.financialAttribute.findFirst({
      where: { id, userId },
    });

    if (!attribute) {
      throw ApiError.notFound("Attribute not found");
    }

    return attribute;
  }

  async getVersions(userId: string, id: string) {
    await this.getById(userId, id);

    return prisma.attributeVersion.findMany({
      where: {
        userId,
        attributeId: id,
      },
      orderBy: { versionNo: "desc" },
    });
  }
}

export default new AttributesService();
