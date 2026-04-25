import fs from "node:fs/promises";
import path from "node:path";
import { VertexAI } from "@google-cloud/vertexai";
import { env } from "../../config/env.js";

const SYSTEM_PROMPT = `
You are a senior financial reporting analyst.

Analyze the uploaded spreadsheet summary and return ONLY plain text.

Output rules:
- Do not return JSON.
- Do not return markdown lists, tables, or code blocks.
- Do not use bullets or numbering.
- Use only normal paragraphs and bold section titles in this exact style: **Section title**
- Keep the answer human-readable and concise.
- Do not include raw spreadsheet dumps.

Required structure:
**Qisqacha xulosa**
Short executive summary in plain text.

**Muhim topilmalar**
Plain text paragraph covering major financial findings, periods, trends, and important context.

**Risk va ogohlantirishlar**
Plain text paragraph covering risks, anomalies, missing values, inconsistencies, or critical concerns.

**Tavsiyalar**
Plain text paragraph with actionable management recommendations.
`.trim();

function extractResponseText(response: unknown) {
  const candidates = (response as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates ?? [];
  const texts = candidates.flatMap((candidate) =>
    candidate.content?.parts?.map((part) => part.text ?? "").filter(Boolean) ?? [],
  );

  return texts.join("\n").trim();
}

class GeminiService {
  private async fileExists(filePath: string) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async resolveCredentialConfig() {
    if (env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim()) {
      const decoded = Buffer.from(
        env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,
        "base64",
      ).toString("utf8");
      const parsed = JSON.parse(decoded) as { project_id?: string };

      return {
        googleAuthOptions: {
          credentials: JSON.parse(decoded),
          ...(parsed.project_id ? { projectId: parsed.project_id } : {}),
        },
        projectId: parsed.project_id,
      };
    }

    const configuredPath = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    if (!configuredPath) {
      throw new Error(
        "Google credentials are not configured. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64.",
      );
    }

    const candidates = [
      configuredPath,
      path.resolve(process.cwd(), configuredPath),
      path.resolve(process.cwd(), configuredPath.replace(/^\/+/, "")),
      path.resolve(process.cwd(), path.basename(configuredPath)),
    ];

    const resolvedPath = (
      await Promise.all(
        candidates.map(async (candidate) => ({
          candidate,
          exists: await this.fileExists(candidate),
        })),
      )
    ).find((entry) => entry.exists)?.candidate;

    if (!resolvedPath) {
      throw new Error(
        `Google credentials file was not found. Checked: ${candidates.join(", ")}`,
      );
    }

    process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;

    const raw = await fs.readFile(resolvedPath, "utf8");
    const parsed = JSON.parse(raw) as { project_id?: string };

    return {
      googleAuthOptions: {
        keyFilename: resolvedPath,
        ...(parsed.project_id ? { projectId: parsed.project_id } : {}),
      },
      projectId: parsed.project_id,
    };
  }

  async analyzeFinancialSummary(summary: unknown) {
    const credentialConfig = await this.resolveCredentialConfig();
    const projectId =
      env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== "your-project-id"
        ? env.GOOGLE_CLOUD_PROJECT
        : credentialConfig.projectId;

    if (!projectId) {
      throw new Error(
        "GOOGLE_CLOUD_PROJECT is not configured and could not be inferred from the service account credentials.",
      );
    }

    const vertexAI = new VertexAI({
      project: projectId,
      location: env.GOOGLE_CLOUD_LOCATION,
      googleAuthOptions: credentialConfig.googleAuthOptions,
    });

    const generativeModel = vertexAI.getGenerativeModel({
      model: env.VERTEX_AI_MODEL,
      systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }],
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: "text/plain",
      },
    });

    const requestPayload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Please analyze this spreadsheet summary and answer using only plain text paragraphs with bold section titles.\n\nSpreadsheet summary:\n${JSON.stringify(summary, null, 2)}`,
            },
          ],
        },
      ],
    };

    const result = await generativeModel.generateContent(requestPayload);
    const response = result.response;
    const responseText = extractResponseText(response);

    return {
      requestPayload,
      responseText,
      responseJson: null,
      tokenUsage: (response as { usageMetadata?: unknown })?.usageMetadata ?? null,
    };
  }
}

export default new GeminiService();

// import fs from "node:fs/promises";
// import path from "node:path";
// import { VertexAI } from "@google-cloud/vertexai";
// import { env } from "../../config/env.js";

// type GoogleCredentialConfig = {
//   googleAuthOptions: {
//     credentials?: Record<string, unknown>;
//     keyFilename?: string;
//     projectId?: string;
//   };
//   projectId: string | undefined;
// };

// type GeminiGenerateResponse = {
//   candidates?: Array<{
//     content?: {
//       parts?: Array<{
//         text?: string;
//       }>;
//     };
//   }>;
//   usageMetadata?: unknown;
// };

// type AnalysisSeverity = "low" | "medium" | "high";
// type CategoryType = "income" | "expense" | "unknown";

// export type FinancialAnalysisJson = {
//   reportType: string;
//   language: string;
//   summary: string;
//   period: {
//     start: string | null;
//     end: string | null;
//   };
//   metrics: {
//     incomeTotal: number | null;
//     expenseTotal: number | null;
//     netTotal: number | null;
//     transactionCount: number | null;
//     averageTransaction: number | null;
//   };
//   categories: Array<{
//     name: string;
//     total: number | null;
//     count: number | null;
//     type: CategoryType;
//   }>;
//   anomalies: Array<{
//     title: string;
//     description: string;
//     severity: AnalysisSeverity;
//     rowReference: string | null;
//   }>;
//   risks: Array<{
//     title: string;
//     description: string;
//     recommendation: string;
//     severity?: AnalysisSeverity;
//   }>;
//   recommendations: string[];
//   warnings: Array<{
//     title: string;
//     description: string;
//     severity: AnalysisSeverity;
//   }>;
//   errors: Array<{
//     title: string;
//     description: string;
//     severity: AnalysisSeverity;
//   }>;
//   dashboardSuggestions: {
//     charts: Array<{
//       type: "line" | "bar" | "pie";
//       title: string;
//       x: string;
//       y: string;
//     }>;
//   };
// };

// const SYSTEM_PROMPT = `
// You are a senior financial reporting analyst.

// Your job:
// - Analyze spreadsheet data from uploaded Excel/CSV files.
// - The spreadsheet may have unknown structure, multiple sheets, mixed languages, inconsistent headers, and messy financial rows.
// - Detect financial attributes, periods, categories, income, expenses, balances, anomalies, missing values, duplicate rows, risks, warnings, critical errors, and management insights.
// - Return ONLY a valid JSON object.
// - Do not use markdown.
// - Do not wrap JSON in triple backticks.
// - Do not include explanation outside JSON.
// - Do not return raw spreadsheet data.
// - Use null when a value is unknown.
// `.trim();

// const EXPECTED_JSON_SHAPE = {
//   reportType:
//     "bank_statement | income_statement | cashflow | expense_report | financial_summary | unknown",
//   language: "uz | ru | en | mixed | unknown",
//   summary: "Human-readable executive summary. No JSON text here.",
//   period: {
//     start: "YYYY-MM-DD | null",
//     end: "YYYY-MM-DD | null",
//   },
//   metrics: {
//     incomeTotal: "number | null",
//     expenseTotal: "number | null",
//     netTotal: "number | null",
//     transactionCount: "number | null",
//     averageTransaction: "number | null",
//   },
//   categories: [
//     {
//       name: "Category name",
//       total: "number | null",
//       count: "number | null",
//       type: "income | expense | unknown",
//     },
//   ],
//   anomalies: [
//     {
//       title: "Short anomaly title",
//       description: "Clear explanation",
//       severity: "low | medium | high",
//       rowReference: "Sheet/row reference | null",
//     },
//   ],
//   risks: [
//     {
//       title: "Risk title",
//       description: "Risk explanation",
//       recommendation: "Recommended action",
//       severity: "low | medium | high",
//     },
//   ],
//   recommendations: ["Actionable recommendation"],
//   warnings: [
//     {
//       title: "Warning title",
//       description: "Warning explanation",
//       severity: "medium",
//     },
//   ],
//   errors: [
//     {
//       title: "Critical issue title",
//       description: "Critical issue explanation",
//       severity: "high",
//     },
//   ],
//   dashboardSuggestions: {
//     charts: [
//       {
//         type: "line | bar | pie",
//         title: "Chart title",
//         x: "x axis field",
//         y: "y axis field",
//       },
//     ],
//   },
// };

// const MAX_SUMMARY_CHARS = 120_000;

// function isObject(value: unknown): value is Record<string, unknown> {
//   return typeof value === "object" && value !== null && !Array.isArray(value);
// }

// function asString(value: unknown, fallback = ""): string {
//   return typeof value === "string" ? value.trim() : fallback;
// }

// function asNullableString(value: unknown): string | null {
//   const text = asString(value);
//   return text.length ? text : null;
// }

// function asNumberOrNull(value: unknown): number | null {
//   if (typeof value === "number" && Number.isFinite(value)) return value;

//   if (typeof value === "string") {
//     const normalized = value.replace(/\s/g, "").replace(",", ".");
//     const parsed = Number(normalized);
//     return Number.isFinite(parsed) ? parsed : null;
//   }

//   return null;
// }

// function normalizeSeverity(value: unknown): AnalysisSeverity {
//   const severity = asString(value).toLowerCase();
//   if (severity === "low" || severity === "medium" || severity === "high") {
//     return severity;
//   }
//   return "medium";
// }

// function normalizeCategoryType(value: unknown): CategoryType {
//   const type = asString(value).toLowerCase();
//   if (type === "income" || type === "expense" || type === "unknown") {
//     return type;
//   }
//   return "unknown";
// }

// function safeJsonStringify(value: unknown, maxChars = MAX_SUMMARY_CHARS): string {
//   const seen = new WeakSet<object>();

//   const json = JSON.stringify(
//     value,
//     (_key, currentValue) => {
//       if (typeof currentValue === "bigint") return currentValue.toString();

//       if (typeof currentValue === "object" && currentValue !== null) {
//         if (seen.has(currentValue)) return "[Circular]";
//         seen.add(currentValue);
//       }

//       return currentValue;
//     },
//     2,
//   );

//   if (!json) return "{}";

//   if (json.length <= maxChars) return json;

//   return `${json.slice(
//     0,
//     maxChars,
//   )}\n\n[TRUNCATED: spreadsheet summary was too large. Analyze only the visible structured sample and infer cautiously.]`;
// }

// function extractResponseText(response: unknown): string {
//   const candidates = (response as GeminiGenerateResponse)?.candidates ?? [];

//   const texts = candidates.flatMap((candidate) => {
//     const parts = candidate.content?.parts ?? [];
//     return parts
//       .map((part) => part.text)
//       .filter((text): text is string => Boolean(text?.trim()));
//   });

//   return texts.join("\n").trim();
// }

// function stripJsonCodeFence(text: string): string {
//   return text
//     .trim()
//     .replace(/^```(?:json)?/i, "")
//     .replace(/```$/i, "")
//     .trim();
// }

// function extractJsonCandidate(text: string): string {
//   const cleaned = stripJsonCodeFence(text);

//   if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
//     return cleaned;
//   }

//   const firstBrace = cleaned.indexOf("{");
//   const lastBrace = cleaned.lastIndexOf("}");

//   if (firstBrace >= 0 && lastBrace > firstBrace) {
//     return cleaned.slice(firstBrace, lastBrace + 1);
//   }

//   return cleaned;
// }

// function parseJsonSafely(text: string): unknown | null {
//   if (!text.trim()) return null;

//   const candidate = extractJsonCandidate(text);

//   try {
//     return JSON.parse(candidate);
//   } catch {
//     return null;
//   }
// }

// function normalizeStringArray(value: unknown): string[] {
//   if (!Array.isArray(value)) return [];

//   return value
//     .map((item) => {
//       if (typeof item === "string") return item.trim();

//       if (isObject(item)) {
//         return (
//           asString(item.recommendation) ||
//           asString(item.description) ||
//           asString(item.title)
//         );
//       }

//       return "";
//     })
//     .filter(Boolean);
// }

// function normalizeFinancialAnalysisJson(value: unknown): FinancialAnalysisJson {
//   const root = isObject(value) ? value : {};

//   const period = isObject(root.period) ? root.period : {};
//   const metrics = isObject(root.metrics) ? root.metrics : {};
//   const dashboardSuggestions = isObject(root.dashboardSuggestions)
//     ? root.dashboardSuggestions
//     : {};

//   const categories = Array.isArray(root.categories) ? root.categories : [];
//   const anomalies = Array.isArray(root.anomalies) ? root.anomalies : [];
//   const risks = Array.isArray(root.risks) ? root.risks : [];
//   const warnings = Array.isArray(root.warnings) ? root.warnings : [];
//   const errors = Array.isArray(root.errors) ? root.errors : [];

//   const charts = Array.isArray(dashboardSuggestions.charts)
//     ? dashboardSuggestions.charts
//     : [];

//   return {
//     reportType: asString(root.reportType, "unknown"),
//     language: asString(root.language, "unknown"),
//     summary:
//       asString(root.summary) ||
//       "Ushbu moliyaviy hisobot yuklangan fayl asosida avtomatik tahlil qilindi.",
//     period: {
//       start: asNullableString(period.start),
//       end: asNullableString(period.end),
//     },
//     metrics: {
//       incomeTotal: asNumberOrNull(metrics.incomeTotal),
//       expenseTotal: asNumberOrNull(metrics.expenseTotal),
//       netTotal: asNumberOrNull(metrics.netTotal),
//       transactionCount: asNumberOrNull(metrics.transactionCount),
//       averageTransaction: asNumberOrNull(metrics.averageTransaction),
//     },
//     categories: categories.filter(isObject).map((category) => ({
//       name: asString(category.name, "Unknown category"),
//       total: asNumberOrNull(category.total),
//       count: asNumberOrNull(category.count),
//       type: normalizeCategoryType(category.type),
//     })),
//     anomalies: anomalies.filter(isObject).map((anomaly) => ({
//       title: asString(anomaly.title, "Anomaly"),
//       description: asString(anomaly.description),
//       severity: normalizeSeverity(anomaly.severity),
//       rowReference: asNullableString(anomaly.rowReference),
//     })),
//     risks: risks.filter(isObject).map((risk) => ({
//       title: asString(risk.title, "Risk"),
//       description: asString(risk.description),
//       recommendation: asString(risk.recommendation),
//       severity: normalizeSeverity(risk.severity),
//     })),
//     recommendations: normalizeStringArray(root.recommendations),
//     warnings: warnings.filter(isObject).map((warning) => ({
//       title: asString(warning.title, "Warning"),
//       description: asString(warning.description),
//       severity: normalizeSeverity(warning.severity),
//     })),
//     errors: errors.filter(isObject).map((error) => ({
//       title: asString(error.title, "Critical issue"),
//       description: asString(error.description),
//       severity: normalizeSeverity(error.severity),
//     })),
//     dashboardSuggestions: {
//       charts: charts.filter(isObject).map((chart) => {
//         const type = asString(chart.type).toLowerCase();

//         return {
//           type: type === "line" || type === "bar" || type === "pie" ? type : "bar",
//           title: asString(chart.title, "Financial chart"),
//           x: asString(chart.x),
//           y: asString(chart.y),
//         };
//       }),
//     },
//   };
// }

// function buildUserPrompt(summary: unknown): string {
//   return `
// Analyze this spreadsheet summary and return a valid JSON object only.

// Required JSON shape:
// ${JSON.stringify(EXPECTED_JSON_SHAPE, null, 2)}

// Business rules:
// - Summary must be human-readable, not JSON.
// - Recommendations should be actionable positive guidance.
// - Warnings should be data quality or attention-needed issues.
// - Errors should be critical/incorrect/invalid data issues.
// - Anomalies should have severity low, medium, or high.
// - Use null for unknown numeric/date values.
// - If categories or metrics are not confidently detected, return empty arrays or null values.
// - Never include markdown or code fences.

// Spreadsheet summary:
// ${safeJsonStringify(summary)}
// `.trim();
// }

// class GeminiService {
//   private credentialConfigPromise: Promise<GoogleCredentialConfig> | null = null;
//   private vertexAIPromise: Promise<VertexAI> | null = null;

//   private async fileExists(filePath: string): Promise<boolean> {
//     try {
//       await fs.access(filePath);
//       return true;
//     } catch {
//       return false;
//     }
//   }

//   private async resolveCredentialConfig(): Promise<GoogleCredentialConfig> {
//     if (this.credentialConfigPromise) {
//       return this.credentialConfigPromise;
//     }

//     this.credentialConfigPromise = this.resolveCredentialConfigInternal();
//     return this.credentialConfigPromise;
//   }

//   private async resolveCredentialConfigInternal(): Promise<GoogleCredentialConfig> {
//     const base64Credentials = env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim();

//     if (base64Credentials) {
//       const decoded = Buffer.from(base64Credentials, "base64").toString("utf8");
//       const credentials = JSON.parse(decoded) as Record<string, unknown>;
//       const projectId =
//         typeof credentials.project_id === "string"
//           ? credentials.project_id
//           : undefined;

//       return {
//         googleAuthOptions: {
//           credentials,
//           ...(projectId ? { projectId } : {}),
//         },
//         projectId,
//       };
//     }

//     const configuredPath = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

//     if (!configuredPath) {
//       throw new Error(
//         "Google credentials are not configured. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64.",
//       );
//     }

//     const candidates = Array.from(
//       new Set([
//         configuredPath,
//         path.resolve(process.cwd(), configuredPath),
//         path.resolve(process.cwd(), configuredPath.replace(/^\/+/, "")),
//         path.resolve(process.cwd(), path.basename(configuredPath)),
//       ]),
//     );

//     const checks = await Promise.all(
//       candidates.map(async (candidate) => ({
//         candidate,
//         exists: await this.fileExists(candidate),
//       })),
//     );

//     const resolvedPath = checks.find((entry) => entry.exists)?.candidate;

//     if (!resolvedPath) {
//       throw new Error(
//         `Google credentials file was not found. Checked: ${candidates.join(", ")}`,
//       );
//     }

//     process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;

//     const raw = await fs.readFile(resolvedPath, "utf8");
//     const credentials = JSON.parse(raw) as { project_id?: string };

//     return {
//       googleAuthOptions: {
//         keyFilename: resolvedPath,
//         ...(credentials.project_id ? { projectId: credentials.project_id } : {}),
//       },
//       projectId: credentials.project_id,
//     };
//   }

//   private async getVertexAI(): Promise<VertexAI> {
//     if (this.vertexAIPromise) {
//       return this.vertexAIPromise;
//     }

//     this.vertexAIPromise = this.createVertexAI();
//     return this.vertexAIPromise;
//   }

//   private async createVertexAI(): Promise<VertexAI> {
//     const credentialConfig = await this.resolveCredentialConfig();

//     const envProjectId = env.GOOGLE_CLOUD_PROJECT?.trim();
//     const projectId =
//       envProjectId && envProjectId !== "your-project-id"
//         ? envProjectId
//         : credentialConfig.projectId;

//     if (!projectId) {
//       throw new Error(
//         "GOOGLE_CLOUD_PROJECT is not configured and could not be inferred from the service account credentials.",
//       );
//     }

//     return new VertexAI({
//       project: projectId,
//       location: env.GOOGLE_CLOUD_LOCATION,
//       googleAuthOptions: credentialConfig.googleAuthOptions,
//     });
//   }

//   async analyzeFinancialSummary(summary: unknown) {
//     const vertexAI = await this.getVertexAI();

//     const generativeModel = vertexAI.getGenerativeModel({
//       model: env.VERTEX_AI_MODEL,
//       systemInstruction: {
//         role: "system",
//         parts: [{ text: SYSTEM_PROMPT }],
//       },
//       generationConfig: {
//         temperature: 0.1,
//         topP: 0.8,
//         maxOutputTokens: 8192,
//         responseMimeType: "application/json",
//       },
//     });

//     const requestPayload = {
//       contents: [
//         {
//           role: "user",
//           parts: [{ text: buildUserPrompt(summary) }],
//         },
//       ],
//     };

//     const result = await generativeModel.generateContent(requestPayload);
//     const response = result.response as GeminiGenerateResponse;
//     const responseText = extractResponseText(response);

//     if (!responseText) {
//       throw new Error("Gemini returned an empty response.");
//     }

//     const parsedJson = parseJsonSafely(responseText);
//     const normalizedJson = normalizeFinancialAnalysisJson(parsedJson);

//     return {
//       requestPayload,
//       responseText,
//       responseJson: normalizedJson,
//       rawResponseJson: parsedJson,
//       tokenUsage: response.usageMetadata ?? null,
//     };
//   }
// }

// export default new GeminiService();
