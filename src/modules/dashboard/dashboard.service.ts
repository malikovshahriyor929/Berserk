import { prisma } from "../../config/prisma.js";
import { AiAnalysisStatus } from "../../generated/prisma/enums.js";
import { formatBucket, getRangeBucket, getRangeStart, type RangeKey } from "../../utils/date-range.js";

function toNumeric(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isIncome(key: string, label: string) {
  const sample = `${key} ${label}`.toLowerCase();
  return sample.includes("income") || sample.includes("revenue") || sample.includes("credit");
}

function isExpense(key: string, label: string) {
  const sample = `${key} ${label}`.toLowerCase();
  return sample.includes("expense") || sample.includes("debit") || sample.includes("cost") || sample.includes("fee");
}

class DashboardService {
  async getSummary(userId: string, range: RangeKey) {
    const startDate = getRangeStart(range);

    const [uploads, reports, attributes, analyses] = await Promise.all([
      prisma.uploadedFile.findMany({
        where: { userId, createdAt: { gte: startDate } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.generatedReport.findMany({
        where: { userId, createdAt: { gte: startDate } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.financialAttribute.findMany({
        where: { userId, updatedAt: { gte: startDate } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.aiAnalysis.findMany({
        where: { userId, createdAt: { gte: startDate } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    let income = 0;
    let expense = 0;
    for (const attribute of attributes) {
      const value = Number(attribute.currentValueNumber ?? 0);
      if (isIncome(attribute.attributeKey, attribute.label)) {
        income += value;
      } else if (isExpense(attribute.attributeKey, attribute.label)) {
        expense += Math.abs(value);
      }
    }

    const anomalies = analyses
      .flatMap((analysis) => {
        const result = analysis.resultJson as { anomalies?: unknown[] } | null;
        return result?.anomalies ?? [];
      })
      .slice(0, 10);

    return {
      range,
      totalUploads: uploads.length,
      totalReports: reports.length,
      totalAttributes: attributes.length,
      totalAnalyses: analyses.length,
      latestUpload: uploads[0] ?? null,
      latestAnalysis: analyses[0] ?? null,
      financialTotals: {
        income,
        expense,
        net: income - expense,
      },
      uploadsOverTime: uploads.map((upload) => ({
        id: upload.id,
        date: upload.createdAt,
        name: upload.originalName,
        status: upload.status,
      })),
      reportsOverTime: reports.map((report) => ({
        id: report.id,
        date: report.createdAt,
        title: report.title,
      })),
      detectedCategories: attributes
        .filter((attribute) => attribute.attributeKey.includes("category"))
        .slice(0, 20)
        .map((attribute) => attribute.currentValueText ?? attribute.label),
      topAnomalies: anomalies,
      analysisStatusDistribution: {
        pending: analyses.filter((item) => item.status === AiAnalysisStatus.PENDING).length,
        running: analyses.filter((item) => item.status === AiAnalysisStatus.RUNNING).length,
        success: analyses.filter((item) => item.status === AiAnalysisStatus.SUCCESS).length,
        failed: analyses.filter((item) => item.status === AiAnalysisStatus.FAILED).length,
      },
    };
  }

  async getCharts(userId: string, range: RangeKey) {
    const startDate = getRangeStart(range);
    const bucket = getRangeBucket(range);

    const [uploads, reports, versions, analyses] = await Promise.all([
      prisma.uploadedFile.findMany({
        where: { userId, createdAt: { gte: startDate } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.generatedReport.findMany({
        where: { userId, createdAt: { gte: startDate } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.attributeVersion.findMany({
        where: {
          userId,
          isLatest: true,
          OR: [
            { validFrom: { gte: startDate } },
            { periodDate: { gte: startDate } },
          ],
        },
        include: {
          attribute: {
            select: {
              attributeKey: true,
              label: true,
            },
          },
        },
        orderBy: { validFrom: "asc" },
      }),
      prisma.aiAnalysis.findMany({
        where: { userId, createdAt: { gte: startDate } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const uploadsOverTime = Object.values(
      uploads.reduce<Record<string, { date: string; count: number }>>((acc, upload) => {
        const key = formatBucket(upload.createdAt, bucket);
        acc[key] = acc[key] ?? { date: key, count: 0 };
        acc[key].count += 1;
        return acc;
      }, {}),
    );

    const reportsOverTime = Object.values(
      reports.reduce<Record<string, { date: string; count: number }>>((acc, report) => {
        const key = formatBucket(report.createdAt, bucket);
        acc[key] = acc[key] ?? { date: key, count: 0 };
        acc[key].count += 1;
        return acc;
      }, {}),
    );

    const financialTrend = Object.values(
      versions.reduce<Record<string, { date: string; income: number; expense: number; net: number }>>((acc, version) => {
        const date = version.periodDate ?? version.validFrom;
        const key = formatBucket(date, bucket);
        const amount = Number(version.valueNumber ?? 0);
        const target = acc[key] ?? { date: key, income: 0, expense: 0, net: 0 };

        if (isIncome(version.attribute.attributeKey, version.attribute.label)) {
          target.income += amount;
        } else if (isExpense(version.attribute.attributeKey, version.attribute.label)) {
          target.expense += Math.abs(amount);
        }

        target.net = target.income - target.expense;
        acc[key] = target;
        return acc;
      }, {}),
    );

    const categories = analyses
      .flatMap((analysis) => {
        const result = analysis.resultJson as { categories?: Array<{ name?: string; total?: number }> } | null;
        return result?.categories ?? [];
      })
      .reduce<Record<string, number>>((acc, category) => {
        const name = category.name ?? "unknown";
        acc[name] = (acc[name] ?? 0) + toNumeric(category.total);
        return acc;
      }, {});

    return {
      range,
      uploadsOverTime,
      reportsOverTime,
      financialTrend,
      categories: Object.entries(categories).map(([name, value]) => ({ name, value })),
    };
  }

  async getRecentUploads(userId: string, limit: number) {
    return prisma.uploadedFile.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getRecentReports(userId: string, limit: number) {
    return prisma.generatedReport.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}

export default new DashboardService();
