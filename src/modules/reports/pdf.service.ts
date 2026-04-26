import puppeteer from "puppeteer";
// @ts-ignore
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
        margin: 50,
        info: {
          Title: input.title,
          Author: "Berserk Financial Platform",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: any) => chunks.push(Buffer.from(chunk)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Helper for drawing a header line
      const drawHorizontalLine = (y: number) => {
        doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).strokeColor("#E5E7EB").stroke();
      };

      // Header
      doc.fillColor("#112855").fontSize(24).font("Helvetica-Bold").text("Berserk", { align: "left" });
      doc.fillColor("#64748B").fontSize(10).font("Helvetica").text("Moliyaviy tahlil hisoboti", { align: "left" });
      doc.moveDown(1.5);

      const headerY = doc.y;
      doc.fillColor("#111827").fontSize(18).font("Helvetica-Bold").text(input.title);
      doc.fillColor("#4B5563").fontSize(12).font("Helvetica").text(input.upload.originalName);
      doc.moveDown(0.5);
      drawHorizontalLine(doc.y);
      doc.moveDown(1);

      // Meta info in two columns
      const metaTop = doc.y;
      const addMeta = (label: string, value: string, x: number) => {
        doc.fillColor("#64748B").fontSize(9).font("Helvetica-Bold").text(label.toUpperCase(), x, doc.y);
        doc.fillColor("#111827").fontSize(11).font("Helvetica").text(value, x);
        doc.moveDown(0.5);
      };

      addMeta("Sana", formatDateTime(input.generatedAt), 50);
      addMeta("Foydalanuvchi", input.user.fullName || input.user.name || input.user.email, 50);
      
      doc.y = metaTop;
      addMeta("Hisobot turi", parsed.reportType, 300);
      addMeta("Davr", `${parsed.periodStart} - ${parsed.periodEnd}`, 300);

      doc.x = 50;
      doc.moveDown(1);
      drawHorizontalLine(doc.y);
      doc.moveDown(1.5);

      const addSection = (title: string, color = "#112855") => {
        doc.moveDown(0.5);
        doc.fillColor(color).fontSize(14).font("Helvetica-Bold").text(title);
        doc.moveDown(0.4);
        doc.fillColor("#111827").fontSize(10).font("Helvetica");
      };

      // Try to load a unicode font if available on the system
      const fontPaths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
      ];
      
      let fontLoaded = false;
      for (const fp of fontPaths) {
        try {
          doc.font(fp);
          fontLoaded = true;
          break;
        } catch {
          // ignore
        }
      }

      if (!fontLoaded) {
        doc.font("Helvetica");
      }

      addSection("Qisqacha xulosa");
      parsed.summary.forEach((item) => {
        doc.fillColor("#374151").text(`• ${item}`, { lineGap: 3 });
      });

      addSection("Asosiy ko'rsatkichlar");
      doc.moveDown(0.2);
      
      // Metrics Grid (2 columns)
      const metricsTop = doc.y;
      parsed.metrics.forEach((metric, index) => {
        const xPos = index % 2 === 0 ? 50 : 300;
        const yPos = metricsTop + Math.floor(index / 2) * 45;
        
        doc.rect(xPos, yPos, 230, 40).fill("#F9FAFB");
        doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text(metric.label.toUpperCase(), xPos + 10, yPos + 8);
        doc.fillColor("#112855").fontSize(12).font("Helvetica-Bold").text(metric.value, xPos + 10, yPos + 20);
      });
      
      doc.y = metricsTop + Math.ceil(parsed.metrics.length / 2) * 50 + 10;
      doc.x = 50;

      if (parsed.anomalies.length) {
        addSection("Anomaliyalar", "#DC2626");
        parsed.anomalies.slice(0, 5).forEach((anomaly) => {
          doc.fillColor("#111827").font("Helvetica-Bold").text(`${anomaly.title}`);
          doc.fillColor("#4B5563").font("Helvetica").fontSize(9).text(anomaly.description, { indent: 10 });
          doc.moveDown(0.4);
        });
      }

      if (parsed.recommendations.length) {
        addSection("Tavsiyalar", "#16A34A");
        parsed.recommendations.slice(0, 10).forEach((rec) => {
          doc.fillColor("#374151").text(`• ${rec}`, { indent: 10, lineGap: 2 });
        });
      }

      // Footer
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fillColor("#9CA3AF").fontSize(8).text(
          `Berserk Financial Platform | ${formatDateTime(input.generatedAt)} | Sahifa ${i + 1}`,
          50,
          doc.page.height - 40,
          { align: "center" }
        );
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
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });

      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: "networkidle0",
        timeout: 60000,
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
              <span>Berserk Financial Platform</span>
              <span>Sahifa <span class="pageNumber"></span> / <span class="totalPages"></span> · ${formatDateTime(input.generatedAt)}</span>
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
