import { VertexAI } from "@google-cloud/vertexai";
import { env } from "../../config/env.js";
import fs from "node:fs/promises";
import path from "node:path";
import { parseJsonSafely, normalizeForecastResult } from "./forecast-normalizer.js";

const SYSTEM_PROMPT = `
You are a senior financial forecasting analyst.

You analyze historical financial data extracted from Excel/CSV files. Your task is to produce a structured forecast based on the provided historical time series, baseline forecast, and data quality issues.

Strict rules:
- Return ONLY valid JSON.
- Do not use markdown.
- Do not use code fences.
- Do not include explanations outside JSON.
- Do not copy raw input JSON into the output.
- Use null when a value is unknown.
- Never invent exact values when historical data is insufficient.
- If there is insufficient historical data, set status to "INSUFFICIENT_DATA" and explain why.
- Forecast must be based on historical trends, seasonality, volatility, and visible anomalies.
- Always include recommendations, warnings, and errors arrays.
- Recommendations are positive actionable suggestions.
- Warnings are medium-severity attention-needed issues.
- Errors are high-severity data problems or critical reliability problems.
- Output must match the required schema exactly.

Required JSON schema:
{
  "status": "SUCCESS | INSUFFICIENT_DATA",
  "forecastType": "financial_forecast",
  "horizon": "NEXT_MONTH | NEXT_QUARTER | NEXT_YEAR | CUSTOM",
  "scenario": "CONSERVATIVE | BASE | OPTIMISTIC",
  "summary": "Human-readable forecast summary",
  "methodology": {
    "primaryMethod": "moving_average | linear_trend | yoy_growth | mixed | insufficient_data",
    "explanation": "Human-readable explanation",
    "confidence": 0.0
  },
  "period": {
    "historicalStart": "YYYY-MM-DD | null",
    "historicalEnd": "YYYY-MM-DD | null",
    "forecastStart": "YYYY-MM-DD | null",
    "forecastEnd": "YYYY-MM-DD | null"
  },
  "metrics": {
    "predictedIncomeTotal": 0,
    "predictedExpenseTotal": 0,
    "predictedNetTotal": 0,
    "predictedCashflow": 0,
    "growthRate": 0,
    "confidence": 0.0
  },
  "forecastPoints": [
    {
      "period": "YYYY-MM or YYYY-QN or YYYY",
      "metricKey": "incomeTotal",
      "metricLabel": "Income total",
      "predictedValue": 0,
      "lowerBound": 0,
      "upperBound": 0,
      "confidence": 0.0,
      "scenario": "BASE",
      "explanation": "Why this value is expected"
    }
  ],
  "trendInsights": [
    {
      "title": "Trend title",
      "description": "Trend explanation",
      "impact": "positive | neutral | negative"
    }
  ],
  "recommendations": [
    {
      "title": "Recommendation title",
      "description": "Actionable recommendation",
      "priority": "low | medium | high"
    }
  ],
  "warnings": [
    {
      "title": "Warning title",
      "description": "Warning explanation",
      "severity": "medium",
      "rowReference": "optional"
    }
  ],
  "errors": [
    {
      "title": "Critical issue title",
      "description": "Critical problem explanation",
      "severity": "high",
      "rowReference": "optional"
    }
  ],
  "dataQuality": {
    "score": 0,
    "summary": "Data quality summary",
    "issuesCount": 0
  }
}
`.trim();

class ForecastAiService {
  async runForecast(input: any) {
    const credentialConfig = await this.resolveCredentialConfig();
    const projectId = env.GOOGLE_CLOUD_PROJECT || credentialConfig.projectId;

    if (!projectId) {
      throw new Error("Google Cloud Project ID not found.");
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
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    const userPrompt = `
Analyze the historical financial data and provide a forecast.
Upload metadata: ${JSON.stringify(input.metadata)}
Historical time series: ${JSON.stringify(input.detectedMetrics)}
Baseline forecast: ${JSON.stringify(input.baselineForecast)}
Data quality issues: ${JSON.stringify(input.dataQualityIssues)}
Selected horizon: ${input.horizon}
Selected scenario: ${input.scenario}
Target metric: ${input.targetMetric || "auto-detect"}
    `;

    const requestPayload = {
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    };

    const result = await generativeModel.generateContent(requestPayload);
    const response = result.response;
    const responseText = this.extractResponseText(response);
    
    if (!responseText) {
      throw new Error("Empty response from Gemini");
    }

    const parsed = parseJsonSafely(responseText);
    const normalized = normalizeForecastResult(parsed);

    return {
      normalized,
      raw: parsed,
      tokenUsage: (response as any).usageMetadata || null,
    };
  }

  private extractResponseText(response: any): string {
    const candidates = response.candidates || [];
    const texts = candidates.flatMap((c: any) => 
      c.content?.parts?.map((p: any) => p.text || "").filter(Boolean) || []
    );
    return texts.join("\n").trim();
  }

  private async resolveCredentialConfig() {
    if (env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim()) {
      const decoded = Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8");
      const parsed = JSON.parse(decoded);
      return {
        googleAuthOptions: { credentials: parsed },
        projectId: parsed.project_id,
      };
    }

    const keyPath = env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!keyPath) throw new Error("Google credentials not configured.");

    const raw = await fs.readFile(path.resolve(process.cwd(), keyPath), "utf8");
    const parsed = JSON.parse(raw);

    return {
      googleAuthOptions: { keyFilename: keyPath },
      projectId: parsed.project_id,
    };
  }
}

export default new ForecastAiService();
