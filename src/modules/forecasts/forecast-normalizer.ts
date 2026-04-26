import type { 
  ForecastStatus, 
  ForecastHorizon, 
  ForecastScenario, 
  ForecastIssueType, 
  ForecastIssueSeverity 
} from "../../generated/prisma/client.js";
import type { ForecastNormalResult, ForecastPointResult, ForecastIssueResult } from "./forecast-types.js";

export function parseJsonSafely(text: string): any {
  try {
    // Remove markdown code blocks if present
    const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleanText);
  } catch (err) {
    console.error("Failed to parse AI JSON response:", err);
    return null;
  }
}

export function normalizeForecastResult(value: any): ForecastNormalResult {
  const data = value || {};

  return {
    status: (data.status === "INSUFFICIENT_DATA" ? "INSUFFICIENT_DATA" : "SUCCESS") as ForecastStatus,
    summary: String(data.summary || "No summary provided."),
    methodology: data.methodology
      ? {
          primaryMethod: String(data.methodology.primaryMethod || "mixed"),
          explanation: String(data.methodology.explanation || ""),
          confidence: Math.min(Math.max(Number(data.methodology.confidence) || 0, 0), 1),
        }
      : undefined,
    period: {
      historicalStart: data.period?.historicalStart || null,
      historicalEnd: data.period?.historicalEnd || null,
      forecastStart: data.period?.forecastStart || null,
      forecastEnd: data.period?.forecastEnd || null,
    },
    metrics: {
      predictedIncomeTotal: Number(data.metrics?.predictedIncomeTotal) || 0,
      predictedExpenseTotal: Number(data.metrics?.predictedExpenseTotal) || 0,
      predictedNetTotal: Number(data.metrics?.predictedNetTotal) || 0,
      predictedCashflow: Number(data.metrics?.predictedCashflow) || 0,
      growthRate: Number(data.metrics?.growthRate) || 0,
      confidence: Math.min(Math.max(Number(data.metrics?.confidence) || 0, 0), 1),
    },
    forecastPoints: (data.forecastPoints || []).map(normalizeForecastPoint),
    trendInsights: (data.trendInsights || []).map((ti: any) => ({
      title: String(ti.title || "Insight"),
      description: String(ti.description || ""),
      impact: ["positive", "neutral", "negative"].includes(ti.impact) ? ti.impact : "neutral",
    })),
    recommendations: (data.recommendations || []).map((r: any) => ({
      title: String(r.title || "Recommendation"),
      description: String(r.description || ""),
      priority: ["low", "medium", "high"].includes(r.priority) ? r.priority : "medium",
    })),
    warnings: (data.warnings || []).map(normalizeIssue),
    errors: (data.errors || []).map(normalizeIssue),
    dataQuality: {
      score: Math.min(Math.max(Number(data.dataQuality?.score) || 0, 0), 100),
      summary: String(data.dataQuality?.summary || ""),
      issuesCount: Number(data.dataQuality?.issuesCount) || 0,
    },
  };
}

export function normalizeForecastPoint(value: any): ForecastPointResult {
  return {
    period: String(value.period || "N/A"),
    metricKey: String(value.metricKey || "unknown"),
    metricLabel: String(value.metricLabel || ""),
    predictedValue: Number(value.predictedValue) || 0,
    lowerBound: value.lowerBound ? Number(value.lowerBound) : undefined,
    upperBound: value.upperBound ? Number(value.upperBound) : undefined,
    confidence: value.confidence ? Math.min(Math.max(Number(value.confidence), 0), 1) : undefined,
    scenario: (["CONSERVATIVE", "BASE", "OPTIMISTIC"].includes(value.scenario) ? value.scenario : "BASE") as ForecastScenario,
    explanation: String(value.explanation || ""),
  };
}

export function normalizeIssue(value: any): ForecastIssueResult {
  return {
    type: value.type || "DATA_QUALITY",
    severity: (["LOW", "MEDIUM", "HIGH"].includes(value.severity?.toUpperCase())
      ? value.severity.toUpperCase()
      : "MEDIUM") as ForecastIssueSeverity,
    title: String(value.title || "Issue"),
    description: String(value.description || ""),
    recommendation: value.recommendation ? String(value.recommendation) : undefined,
    rowReference: value.rowReference ? String(value.rowReference) : undefined,
    fieldReference: value.fieldReference ? String(value.fieldReference) : undefined,
  };
}
