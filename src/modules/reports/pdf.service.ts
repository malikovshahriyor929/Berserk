import puppeteer from "puppeteer";
import chartService from "./charts/chart.service.js";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatEnumLabel,
  formatNumber,
  parseAnalysisResult,
} from "./report-formatters.js";
import { renderReportHtml } from "./templates/default-report.template.js";

type UploadLike = {
  originalName: string;
  uploadedAt: Date;
  sizeBytes: number;
  status: string;
  mimeType?: string | null;
};

type AnalysisLike = {
  status?: string;
  resultJson?: unknown;
  resultText?: string | null;
  completedAt?: Date | null;
};

type AttributeLike = {
  label: string;
  attributeKey: string;
  dataType?: string;
  sheetName?: string | null;
  versionCount?: number;
  currentValueNumber?: unknown;
  currentValueText?: string | null;
  currentValueDate?: Date | null;
};

type TemplateLike = {
  name: string;
  description?: string | null;
  templateJson?: unknown;
};

type UserLike = {
  name?: string | null;
  fullName?: string | null;
  email: string;
};

type PdfInput = {
  title: string;
  upload: UploadLike;
  analysis: AnalysisLike;
  attributes: AttributeLike[];
  template?: TemplateLike | null;
  generatedAt: Date;
  user: UserLike;
};

function attributeCurrentValue(attribute: AttributeLike) {
  if (attribute.currentValueNumber !== null && attribute.currentValueNumber !== undefined) {
    return formatCurrency(attribute.currentValueNumber);
  }

  if (attribute.currentValueText) {
    return attribute.currentValueText;
  }

  if (attribute.currentValueDate) {
    return formatDate(attribute.currentValueDate);
  }

  return "N/A";
}

class PdfService {
  async createFinancialReportPdf(input: PdfInput): Promise<Buffer> {
    const { parsed } = parseAnalysisResult(input.analysis);
    const periodText = `${parsed.periodStart} — ${parsed.periodEnd}`;

    const categoryChart = await chartService.generateCategoryChart(parsed.categories);
    const metricsChart = await chartService.generateMetricsChart(parsed.metrics);

    const html = renderReportHtml({
      title: input.title,
      subtitle: input.upload.originalName,
      user: input.user,
      upload: input.upload,
      analysis: input.analysis,
      reportType: parsed.reportType,
      language: parsed.language,
      periodText,
      summary: parsed.summary,
      metrics: parsed.metrics,
      categories: parsed.categories,
      anomalies: parsed.anomalies,
      risks: parsed.risks,
      recommendations: parsed.recommendations,
      attributesPreview: input.attributes.slice(0, 20).map((attribute) => ({
        attribute: attribute.label || attribute.attributeKey,
        currentValue: attributeCurrentValue(attribute),
        type: formatEnumLabel(attribute.dataType ?? "N/A"),
        sheet: attribute.sheetName ?? "N/A",
        versionCount: formatNumber(attribute.versionCount ?? 0),
      })),
      generatedAt: input.generatedAt,
      charts: {
        categoryChart,
        metricsChart,
      },
      parsedAnalysis: parsed,
    });

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: "networkidle0",
      });

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        margin: {
          top: "18mm",
          right: "12mm",
          bottom: "18mm",
          left: "12mm",
        },
        headerTemplate: "<div></div>",
        footerTemplate: `
          <div style="width:100%; font-size:9px; color:#64748B; padding:0 12mm; font-family:Arial, Helvetica, sans-serif;">
            <div style="width:100%; display:flex; justify-content:space-between; align-items:center;">
              <span>Moliyaviy hisobot</span>
              <span><span class="pageNumber"></span> / <span class="totalPages"></span> · ${formatDateTime(input.generatedAt)}</span>
            </div>
          </div>
        `,
      });

      await page.close();
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}

export default new PdfService();
