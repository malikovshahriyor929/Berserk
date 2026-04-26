import {
  ForecastHorizon,
  ForecastScenario,
  ForecastStatus,
  ForecastIssueType,
  ForecastIssueSeverity,
  ForecastPeriodUnit,
} from "../../generated/prisma/client.js";

export interface ForecastRunDto {
  uploadId: string;
  analysisId?: string;
  horizon: ForecastHorizon;
  customPeriods?: number;
  periodUnit?: ForecastPeriodUnit;
  targetMetric?: string;
  scenario?: ForecastScenario;
}

export interface ForecastPointResult {
  period: string;
  periodStart?: Date | undefined;
  periodEnd?: Date | undefined;
  metricKey: string;
  metricLabel?: string | undefined;
  predictedValue: number;
  lowerBound?: number | undefined;
  upperBound?: number | undefined;
  confidence?: number | undefined;
  scenario?: ForecastScenario | undefined;
  explanation?: string | undefined;
}

export interface ForecastIssueResult {
  type: ForecastIssueType;
  severity: ForecastIssueSeverity;
  title: string;
  description: string;
  recommendation?: string | undefined;
  rowReference?: string | undefined;
  fieldReference?: string | undefined;
}

export interface ForecastNormalResult {
  status: ForecastStatus;
  summary: string;
  methodology?: {
    primaryMethod: string;
    explanation: string;
    confidence: number;
  } | undefined;
  period: {
    historicalStart: string | null;
    historicalEnd: string | null;
    forecastStart: string | null;
    forecastEnd: string | null;
  };
  metrics: {
    predictedIncomeTotal: number;
    predictedExpenseTotal: number;
    predictedNetTotal: number;
    predictedCashflow: number;
    growthRate: number;
    confidence: number;
  };
  forecastPoints: ForecastPointResult[];
  trendInsights: Array<{
    title: string;
    description: string;
    impact: "positive" | "neutral" | "negative";
  }>;
  recommendations: Array<{
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
  }>;
  warnings: ForecastIssueResult[];
  errors: ForecastIssueResult[];
  dataQuality: {
    score: number;
    summary: string;
    issuesCount: number;
  };
}
