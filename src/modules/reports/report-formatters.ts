type PrimitiveRecord = Record<string, unknown>;

export type ReportMetric = {
  label: string;
  value: string;
  helperText?: string;
};

export type ReportCategory = {
  name: string;
  type: string;
  count: string;
  total: string;
};

export type ReportAnomaly = {
  title: string;
  description: string;
  severity: string;
  rowReference: string;
};

export type ReportRisk = {
  title: string;
  description: string;
  recommendation: string;
};

export type ParsedReportAnalysis = {
  reportType: string;
  language: string;
  summary: string[];
  periodStart: string;
  periodEnd: string;
  metrics: ReportMetric[];
  categories: ReportCategory[];
  anomalies: ReportAnomaly[];
  risks: ReportRisk[];
  recommendations: string[];
};

export function asRecord(value: unknown): PrimitiveRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as PrimitiveRecord)
    : null;
}

export function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function formatDate(value: unknown) {
  const date = value instanceof Date
    ? value
    : typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: unknown) {
  const date = value instanceof Date
    ? value
    : typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  const numeric = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function formatCurrency(value: unknown, currency?: string) {
  const formatted = formatNumber(value);
  if (formatted === "N/A") {
    return formatted;
  }

  return currency ? `${formatted} ${currency}` : formatted;
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "N/A";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatStatusLabel(value: unknown) {
  return formatEnumLabel(value);
}

export function formatReportType(value: unknown) {
  return formatEnumLabel(value);
}

export function formatEnumLabel(value: unknown) {
  if (!value) {
    return "N/A";
  }

  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function formatSeverity(value: unknown) {
  const normalized = String(value ?? "unknown").trim().toLowerCase();
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return "Unknown";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function normalizeSummary(text: unknown) {
  const normalized = String(text ?? "").trim();
  if (!normalized) {
    return [
      "Ushbu hisobot yuklangan fayl va aniqlangan moliyaviy atributlar asosida avtomatik shakllantirildi.",
    ];
  }

  return normalized
    .split(/\n{2,}/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractValue(record: PrimitiveRecord, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }

  return undefined;
}

export function parseAnalysisResult(analysis: {
  resultJson?: unknown;
  resultText?: string | null;
}) {
  const payload = asRecord(analysis.resultJson) ?? {};
  const metrics = asRecord(payload.metrics) ?? {};
  const period = asRecord(payload.period) ?? {};

  const categories = asArray<PrimitiveRecord>(payload.categories).map((category) => ({
    name: String(extractValue(category, ["name", "category", "label"]) ?? "Unknown"),
    type: formatEnumLabel(extractValue(category, ["type"]) ?? "N/A"),
    count: formatNumber(extractValue(category, ["count", "transactionCount"])),
    total: formatCurrency(extractValue(category, ["total", "amount", "value"])),
  }));

  const anomalies = asArray<PrimitiveRecord>(payload.anomalies).map((anomaly) => ({
    title: String(extractValue(anomaly, ["title", "name"]) ?? "Untitled anomaly"),
    description: String(extractValue(anomaly, ["description", "details"]) ?? "No description provided."),
    severity: formatSeverity(extractValue(anomaly, ["severity", "level"]) ?? "low"),
    rowReference: String(extractValue(anomaly, ["rowReference", "row", "reference"]) ?? "N/A"),
  }));

  const risks = asArray<PrimitiveRecord>(payload.risks).map((risk) => ({
    title: String(extractValue(risk, ["title", "name"]) ?? "Untitled risk"),
    description: String(extractValue(risk, ["description", "details"]) ?? "No description provided."),
    recommendation: String(extractValue(risk, ["recommendation", "action"]) ?? "No recommendation provided."),
  }));

  const recommendations = asArray(payload.recommendations)
    .map((item) => String(item))
    .filter(Boolean);

  const parsed: ParsedReportAnalysis = {
    reportType: formatReportType(extractValue(payload, ["reportType", "type"]) ?? "N/A"),
    language: formatEnumLabel(extractValue(payload, ["language"]) ?? "N/A"),
    summary: normalizeSummary(extractValue(payload, ["summary", "executiveSummary"]) ?? analysis.resultText),
    periodStart: formatDate(extractValue(payload, ["periodStart"]) ?? period.start),
    periodEnd: formatDate(extractValue(payload, ["periodEnd"]) ?? period.end),
    metrics: [
      {
        label: "Income total",
        value: formatCurrency(extractValue(metrics, ["incomeTotal"]) ?? extractValue(payload, ["incomeTotal"])),
      },
      {
        label: "Expense total",
        value: formatCurrency(extractValue(metrics, ["expenseTotal"]) ?? extractValue(payload, ["expenseTotal"])),
      },
      {
        label: "Net total",
        value: formatCurrency(extractValue(metrics, ["netTotal"]) ?? extractValue(payload, ["netTotal"])),
      },
      {
        label: "Transaction count",
        value: formatNumber(extractValue(metrics, ["transactionCount"]) ?? extractValue(payload, ["transactionCount"])),
      },
      {
        label: "Average transaction",
        value: formatCurrency(extractValue(metrics, ["averageTransaction"]) ?? extractValue(payload, ["averageTransaction"])),
      },
    ],
    categories,
    anomalies,
    risks,
    recommendations,
  };

  return {
    parsed,
    rawPayload: payload,
  };
}
