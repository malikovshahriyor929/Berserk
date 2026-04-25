import {
  formatDate,
  formatDateTime,
  formatFileSize,
  formatStatusLabel,
  type ParsedReportAnalysis,
} from "../report-formatters.js";

type TemplateInput = {
  title: string;
  subtitle: string;
  user: {
    name?: string | null;
    fullName?: string | null;
    email: string;
  };
  upload: {
    originalName: string;
    uploadedAt: Date;
    sizeBytes: number;
    status: string;
  };
  analysis: {
    status?: string;
  };
  reportType: string;
  language: string;
  periodText: string;
  summary: string[];
  metrics: Array<{ label: string; value: string; helperText?: string }>;
  categories: Array<{ name: string; type: string; count: string; total: string }>;
  anomalies: Array<{ title: string; description: string; severity: string; rowReference: string }>;
  risks: Array<{ title: string; description: string; recommendation: string }>;
  recommendations: string[];
  attributesPreview: Array<{
    attribute: string;
    currentValue: string;
    type: string;
    sheet: string;
    versionCount: string;
  }>;
  generatedAt: Date;
  charts: {
    categoryChart: string | null;
    metricsChart: string | null;
  };
  parsedAnalysis: ParsedReportAnalysis;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSummaryCards(input: TemplateInput) {
  const items = [
    { label: "Original filename", value: input.upload.originalName },
    { label: "Upload date", value: formatDate(input.upload.uploadedAt) },
    { label: "File size", value: formatFileSize(input.upload.sizeBytes) },
    { label: "File status", value: formatStatusLabel(input.upload.status) },
    { label: "Analysis status", value: formatStatusLabel(input.analysis.status ?? "SUCCESS") },
    { label: "Report type", value: input.reportType },
    { label: "Language", value: input.language },
    { label: "Period", value: input.periodText },
  ];

  return `
    <section class="section">
      <h2>File overview</h2>
      <div class="overview-grid">
        ${items
          .map(
            (item) => `
              <div class="overview-card">
                <div class="label">${escapeHtml(item.label)}</div>
                <div class="value">${escapeHtml(item.value)}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderMetricsGrid(input: TemplateInput) {
  return `
    <section class="section">
      <h2>Asosiy ko‘rsatkichlar</h2>
      <div class="metrics-grid">
        ${input.metrics
          .map(
            (metric) => `
              <div class="metric-card">
                <div class="metric-label">${escapeHtml(metric.label)}</div>
                <div class="metric-value">${escapeHtml(metric.value)}</div>
                <div class="metric-helper">${escapeHtml(metric.helperText ?? "AI analysis output")}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderCategoryTable(input: TemplateInput) {
  if (input.categories.length === 0) {
    return `
      <section class="section">
        <h2>Category breakdown</h2>
        <p class="empty-state">Kategoriyalar bo‘yicha tafsilot mavjud emas.</p>
      </section>
    `;
  }

  return `
    <section class="section">
      <h2>Category breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Type</th>
            <th class="align-right">Count</th>
            <th class="align-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${input.categories
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.name)}</td>
                  <td>${escapeHtml(item.type)}</td>
                  <td class="align-right">${escapeHtml(item.count)}</td>
                  <td class="align-right">${escapeHtml(item.total)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderAnomalies(input: TemplateInput) {
  if (input.anomalies.length === 0) {
    return `
      <section class="section">
        <h2>Anomalies</h2>
        <p class="empty-state">Muhim anomaliyalar aniqlanmadi.</p>
      </section>
    `;
  }

  return `
    <section class="section">
      <h2>Anomalies</h2>
      <div class="stack">
        ${input.anomalies
          .map(
            (item) => `
              <div class="info-card avoid-break">
                <div class="card-topline">
                  <div class="card-title">${escapeHtml(item.title)}</div>
                  <span class="badge badge-${escapeHtml(item.severity.toLowerCase())}">${escapeHtml(item.severity)}</span>
                </div>
                <p>${escapeHtml(item.description)}</p>
                <div class="muted">Row reference: ${escapeHtml(item.rowReference)}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderRisks(input: TemplateInput) {
  if (input.risks.length === 0) {
    return `
      <section class="section">
        <h2>Risks</h2>
        <p class="empty-state">Muhim risklar aniqlanmadi.</p>
      </section>
    `;
  }

  return `
    <section class="section">
      <h2>Risks</h2>
      <div class="stack">
        ${input.risks
          .map(
            (item) => `
              <div class="info-card avoid-break">
                <div class="card-title">${escapeHtml(item.title)}</div>
                <p>${escapeHtml(item.description)}</p>
                <div class="muted"><strong>Recommendation:</strong> ${escapeHtml(item.recommendation)}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderRecommendations(input: TemplateInput) {
  if (input.recommendations.length === 0) {
    return `
      <section class="section">
        <h2>Recommendations</h2>
        <p class="empty-state">Tavsiyalar mavjud emas.</p>
      </section>
    `;
  }

  return `
    <section class="section">
      <h2>Recommendations</h2>
      <ol class="recommendations">
        ${input.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ol>
    </section>
  `;
}

function renderAttributesTable(input: TemplateInput) {
  if (input.attributesPreview.length === 0) {
    return `
      <section class="section">
        <h2>Parsed attributes summary</h2>
        <p class="empty-state">Atributlar topilmadi.</p>
      </section>
    `;
  }

  return `
    <section class="section">
      <h2>Parsed attributes summary</h2>
      <table>
        <thead>
          <tr>
            <th>Attribute</th>
            <th>Current value</th>
            <th>Type</th>
            <th>Sheet</th>
            <th class="align-right">Version count</th>
          </tr>
        </thead>
        <tbody>
          ${input.attributesPreview
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.attribute)}</td>
                  <td>${escapeHtml(item.currentValue)}</td>
                  <td>${escapeHtml(item.type)}</td>
                  <td>${escapeHtml(item.sheet)}</td>
                  <td class="align-right">${escapeHtml(item.versionCount)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
      <p class="muted small-note">To‘liq atributlar ro‘yxati tizimda saqlangan.</p>
    </section>
  `;
}

export function renderReportHtml(input: TemplateInput) {
  const owner = input.user.fullName || input.user.name || input.user.email;

  return `
    <!doctype html>
    <html lang="uz">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(input.title)}</title>
        <style>
          @page {
            size: A4;
            margin: 24mm 14mm 20mm 14mm;
          }

          :root {
            --brand: #112855;
            --text: #0f172a;
            --muted: #64748b;
            --border: #e5e7eb;
            --surface: #f8fafc;
            --surface-strong: #eef3fb;
            --success: #16a34a;
            --warning: #d97706;
            --danger: #dc2626;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            color: var(--text);
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            line-height: 1.55;
            background: #fff;
          }

          .report {
            display: flex;
            flex-direction: column;
            gap: 22px;
          }

          .hero {
            background: var(--surface);
            border: 1px solid #d9e2f1;
            border-radius: 16px;
            padding: 24px;
            display: grid;
            grid-template-columns: 1.4fr 1fr;
            gap: 24px;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .eyebrow {
            display: inline-block;
            margin-bottom: 10px;
            color: var(--brand);
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          h1 {
            margin: 0 0 8px;
            font-size: 28px;
            line-height: 1.2;
            color: var(--brand);
          }

          .subtitle {
            margin: 0 0 10px;
            font-size: 14px;
            font-weight: 700;
          }

          .muted {
            color: var(--muted);
          }

          .meta-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .meta-item {
            border-bottom: 1px solid var(--border);
            padding-bottom: 8px;
          }

          .meta-item:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }

          .meta-label {
            color: var(--muted);
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .meta-value {
            font-size: 12px;
            font-weight: 700;
            margin-top: 3px;
          }

          .section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .section h2 {
            margin: 0 0 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border);
            color: var(--brand);
            font-size: 18px;
          }

          .overview-grid,
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .overview-card,
          .metric-card {
            background: #fff;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 14px 16px;
          }

          .overview-card .label,
          .metric-label {
            color: var(--muted);
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }

          .overview-card .value {
            margin-top: 6px;
            font-size: 12px;
            font-weight: 700;
          }

          .metric-value {
            margin-top: 10px;
            font-size: 22px;
            line-height: 1.2;
            color: var(--brand);
            font-weight: 700;
          }

          .metric-helper,
          .small-note {
            margin-top: 6px;
            color: var(--muted);
            font-size: 9px;
          }

          .summary p {
            margin: 0 0 10px;
            text-align: justify;
          }

          .charts-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
          }

          .chart-card {
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 14px;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .chart-card h3 {
            margin: 0 0 10px;
            font-size: 13px;
            color: var(--brand);
          }

          .chart-card img {
            display: block;
            width: 100%;
            border-radius: 8px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid var(--border);
            font-size: 10.5px;
          }

          thead {
            display: table-header-group;
          }

          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          th,
          td {
            padding: 10px 12px;
            border-bottom: 1px solid var(--border);
            vertical-align: top;
          }

          th {
            text-align: left;
            background: var(--brand);
            color: #fff;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          tbody tr:nth-child(even) {
            background: var(--surface);
          }

          .align-right {
            text-align: right;
          }

          .stack {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .info-card {
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 14px 16px;
            background: #fff;
          }

          .card-topline {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-start;
          }

          .card-title {
            font-size: 13px;
            font-weight: 700;
            color: var(--text);
          }

          .badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 68px;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 9px;
            font-weight: 700;
            color: #fff;
            text-transform: uppercase;
          }

          .badge-low {
            background: var(--success);
          }

          .badge-medium {
            background: var(--warning);
          }

          .badge-high,
          .badge-critical {
            background: var(--danger);
          }

          .recommendations {
            margin: 0;
            padding-left: 20px;
          }

          .recommendations li {
            margin-bottom: 8px;
          }

          .empty-state {
            padding: 14px 16px;
            border: 1px dashed var(--border);
            border-radius: 12px;
            color: var(--muted);
            background: var(--surface);
          }

          .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <main class="report">
          <section class="hero">
            <div>
              <span class="eyebrow">AI generated report</span>
              <h1>Moliyaviy hisobot</h1>
              <p class="subtitle">${escapeHtml(input.subtitle)}</p>
              <p class="muted">AI tahlil asosida avtomatik yaratilgan hisobot</p>
            </div>
            <div class="meta-grid">
              <div class="meta-item">
                <div class="meta-label">Prepared for</div>
                <div class="meta-value">${escapeHtml(owner)}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">Generated at</div>
                <div class="meta-value">${escapeHtml(formatDateTime(input.generatedAt))}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">Report type</div>
                <div class="meta-value">${escapeHtml(input.reportType)}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">Period</div>
                <div class="meta-value">${escapeHtml(input.periodText)}</div>
              </div>
            </div>
          </section>

          ${renderSummaryCards(input)}

          <section class="section summary">
            <h2>Qisqacha xulosa</h2>
            ${input.summary.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
          </section>

          ${renderMetricsGrid(input)}

          <section class="section">
            <h2>Charts</h2>
            ${
              input.charts.categoryChart || input.charts.metricsChart
                ? `
                  <div class="charts-grid">
                    ${
                      input.charts.categoryChart
                        ? `
                          <div class="chart-card avoid-break">
                            <h3>Category breakdown</h3>
                            <img src="${input.charts.categoryChart}" alt="Category breakdown chart" />
                          </div>
                        `
                        : ""
                    }
                    ${
                      input.charts.metricsChart
                        ? `
                          <div class="chart-card avoid-break">
                            <h3>Financial overview</h3>
                            <img src="${input.charts.metricsChart}" alt="Financial overview chart" />
                          </div>
                        `
                        : ""
                    }
                  </div>
                `
                : `<p class="empty-state">Chart uchun yetarli ma’lumot topilmadi.</p>`
            }
          </section>

          ${renderCategoryTable(input)}
          ${renderAnomalies(input)}
          ${renderRisks(input)}
          ${renderRecommendations(input)}
          ${renderAttributesTable(input)}
        </main>
      </body>
    </html>
  `;
}
