import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { toJsonValue } from "../../utils/json.js";

type TemplatePayload = {
  name: string;
  description?: string | undefined;
  templateJson: unknown;
  htmlTemplate?: string | null | undefined;
  isDefault?: boolean | undefined;
};

type TemplateUpdatePayload = {
  name?: string | undefined;
  description?: string | undefined;
  templateJson?: unknown;
  htmlTemplate?: string | null | undefined;
  isDefault?: boolean | undefined;
};

class ReportTemplateService {
  async create(userId: string, payload: TemplatePayload) {
    if (payload.isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.reportTemplate.create({
      data: {
        userId,
        name: payload.name,
        templateJson: toJsonValue(payload.templateJson),
        isDefault: payload.isDefault ?? false,
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.htmlTemplate !== undefined ? { htmlTemplate: payload.htmlTemplate } : {}),
      },
    });
  }

  async list(userId: string) {
    return prisma.reportTemplate.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async getById(userId: string, id: string) {
    const template = await prisma.reportTemplate.findFirst({
      where: { id, userId },
    });

    if (!template) {
      throw ApiError.notFound("Template not found");
    }

    return template;
  }

  async update(userId: string, id: string, payload: TemplateUpdatePayload) {
    await this.getById(userId, id);

    if (payload.isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.reportTemplate.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.htmlTemplate !== undefined ? { htmlTemplate: payload.htmlTemplate } : {}),
        ...(payload.isDefault !== undefined ? { isDefault: payload.isDefault } : {}),
        ...(payload.templateJson !== undefined ? { templateJson: toJsonValue(payload.templateJson) } : {}),
      },
    });
  }

  async delete(userId: string, id: string) {
    await this.getById(userId, id);
    await prisma.reportTemplate.delete({ where: { id } });
    return { success: true };
  }

  async getDefaultTemplate(userId: string) {
    return prisma.reportTemplate.findFirst({
      where: {
        userId,
        isDefault: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export default new ReportTemplateService();
