import fs from "node:fs/promises";
import path from "node:path";
import { VertexAI } from "@google-cloud/vertexai";
import { env } from "../../config/env.js";

const SYSTEM_PROMPT = `You are a financial reporting analyst. Analyze the uploaded spreadsheet summary. The spreadsheet may have unknown structure, multiple sheets, mixed languages, and inconsistent headers. Identify financial attributes, periods, categories, income, expenses, balances, anomalies, missing values, duplicate rows, risks, and management insights. Return only valid JSON.`;

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
        responseMimeType: "application/json",
      },
    });

    const requestPayload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${SYSTEM_PROMPT}\n\nExpected JSON shape:\n${JSON.stringify(
                {
                  reportType: "bank_statement | income_statement | cashflow | expense_report | unknown",
                  language: "uz | ru | en | mixed | unknown",
                  summary: "...",
                  period: { start: "...", end: "..." },
                  metrics: {
                    incomeTotal: 0,
                    expenseTotal: 0,
                    netTotal: 0,
                    transactionCount: 0,
                    averageTransaction: 0,
                  },
                  categories: [
                    {
                      name: "...",
                      total: 0,
                      count: 0,
                      type: "income | expense | unknown",
                    },
                  ],
                  anomalies: [
                    {
                      title: "...",
                      description: "...",
                      severity: "low | medium | high",
                      rowReference: "...",
                    },
                  ],
                  risks: [
                    {
                      title: "...",
                      description: "...",
                      recommendation: "...",
                    },
                  ],
                  recommendations: ["..."],
                  dashboardSuggestions: {
                    charts: [
                      {
                        type: "line | bar | pie",
                        title: "...",
                        x: "...",
                        y: "...",
                      },
                    ],
                  },
                },
                null,
                2,
              )}\n\nSpreadsheet summary:\n${JSON.stringify(summary, null, 2)}`,
            },
          ],
        },
      ],
    };

    const result = await generativeModel.generateContent(requestPayload);
    const response = result.response;
    const responseText = extractResponseText(response);

    let responseJson: unknown = null;
    try {
      responseJson = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseJson = null;
    }

    return {
      requestPayload,
      responseText,
      responseJson,
      tokenUsage: (response as { usageMetadata?: unknown })?.usageMetadata ?? null,
    };
  }
}

export default new GeminiService();
