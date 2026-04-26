import puppeteer from "puppeteer";
import PDFDocument from "pdfkit";
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
  private buildFallbackPdf(input: PdfInput) {
    const { parsed } = parseAnalysisResult(input.analysis);

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margin: 48,
        info: {
          Title: input.title,
          Author: input.user.fullName || input.user.name || input.user.email,
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: any) => chunks.push(Buffer.from(chunk)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const addLine = (label: string, value: string) => {
        doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
        doc.font("Helvetica").text(value);
      };

      const addSection = (title: string) => {
        doc.moveDown();
        doc.font("Helvetica-Bold").fontSize(14).fillColor("#112855").text(title);
        doc.moveDown(0.4);
        doc.font("Helvetica").fontSize(10).fillColor("#111827");
      };

      doc.font("Helvetica-Bold").fontSize(20).fillColor("#112855").text(input.title);
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(11).fillColor("#374151").text(input.upload.originalName);
      doc.moveDown();

      addLine("Generated", formatDateTime(input.generatedAt));
      addLine("User", input.user.fullName || input.user.name || input.user.email);
      addLine("Report type", parsed.reportType);
      addLine("Language", parsed.language);
      addLine("Period", `${parsed.periodStart} — ${parsed.periodEnd}`);
      addLine("Uploaded", formatDate(input.upload.uploadedAt));

      addSection("Qisqacha xulosa");
      parsed.summary.forEach((item) => {
        doc.text(`• ${item}`);
        doc.moveDown(0.3);
      });

      addSection("Asosiy ko'rsatkichlar");
      parsed.metrics.forEach((metric) => {
        addLine(metric.label, metric.value);
      });

      if (parsed.categories.length) {
        addSection("Kategoriyalar");
        parsed.categories.slice(0, 20).forEach((category) => {
          doc.text(`• ${category.name} | ${category.type} | Count: ${category.count} | Total: ${category.total}`);
        });
      }

      if (parsed.anomalies.length) {
        addSection("Anomaliyalar");
        parsed.anomalies.slice(0, 20).forEach((anomaly) => {
          doc.text(`• [${anomaly.severity}] ${anomaly.title} (${anomaly.rowReference})`);
          doc.fillColor("#4B5563").text(anomaly.description, { indent: 12 });
          doc.fillColor("#111827");
        });
      }

      if (parsed.risks.length) {
        addSection("Risklar");
        parsed.risks.slice(0, 20).forEach((risk) => {
          doc.text(`• ${risk.title}`);
          doc.fillColor("#4B5563").text(risk.description, { indent: 12 });
          doc.text(`Recommendation: ${risk.recommendation}`, { indent: 12 });
          doc.fillColor("#111827");
        });
      }

      if (parsed.recommendations.length) {
        addSection("Tavsiyalar");
        parsed.recommendations.slice(0, 20).forEach((recommendation) => {
          doc.text(`• ${recommendation}`);
        });
      }

      if (input.attributes.length) {
        addSection("Atributlar preview");
        input.attributes.slice(0, 25).forEach((attribute) => {
          doc.text(
            `• ${attribute.label || attribute.attributeKey} | ${formatEnumLabel(attribute.dataType ?? "N/A")} | ${attribute.sheetName ?? "N/A"} | ${attributeCurrentValue(attribute)}`,
          );
        });
      }

      doc.end();
    });
  }

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

    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

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
      await browser.close();
      return Buffer.from(pdf);
    } catch (error) {
      console.error("Puppeteer PDF generation failed, falling back to PDFKit.", error);
      return this.buildFallbackPdf(input);
    }
  }
}

export default new PdfService();
