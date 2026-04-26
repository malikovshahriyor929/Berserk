import { prisma } from "../../config/prisma.js";
import type { 
  ForecastIssueType, 
  ForecastIssueSeverity,
  ForecastScenario 
} from "../../generated/prisma/client.js";
import type { ForecastIssueResult, ForecastPointResult } from "./forecast-types.js";

export interface PreprocessorResult {
  readiness: {
    canForecast: boolean;
    reason: string | null;
    historyPeriods: number;
    dateCoverage: {
      start: string | null;
      end: string | null;
    };
  };
  detectedMetrics: Array<{
    key: string;
    label: string;
    series: Array<{ period: string; value: number }>;
  }>;
  baselineForecast: {
    method: string;
    points: ForecastPointResult[];
  };
  dataQualityIssues: ForecastIssueResult[];
  summaryForAi: any;
}

class ForecastPreprocessorService {
  async prepareData(userId: string, uploadId: string): Promise<PreprocessorResult> {
    const attributes = await prisma.financialAttribute.findMany({
      where: { userId, uploadId },
      orderBy: { periodDate: "asc" },
    });

    const issues: ForecastIssueResult[] = [];
    
    // Group values by metric and period
    const metricGroups: Record<string, { label: string; series: Record<string, number> }> = {};
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    attributes.forEach(attr => {
      if (!attr.periodDate || attr.currentValueNumber === null) return;
      
      const date = new Date(attr.periodDate);
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;

      const period = this.getYearMonth(date);
      const key = attr.attributeKey;

      if (!metricGroups[key]) {
        metricGroups[key] = { label: attr.label, series: {} };
      }
      
      metricGroups[key].series[period] = (metricGroups[key].series[period] || 0) + Number(attr.currentValueNumber);
    });

    const detectedMetrics = Object.entries(metricGroups).map(([key, group]) => ({
      key,
      label: group.label,
      series: Object.entries(group.series)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, value]) => ({ period, value })),
    }));

    if (detectedMetrics.length === 0) {
      return this.insufficientData("No financial metrics with date information found in the file.");
    }

    const maxHistory = Math.max(...detectedMetrics.map(m => m.series.length));
    
    if (maxHistory < 3) {
      return this.insufficientData("At least 3 historical periods are required for forecasting.");
    }

    // Baseline forecast logic (Moving Average)
    const baselinePoints: ForecastPointResult[] = [];
    detectedMetrics.forEach(metric => {
      if (metric.series.length >= 3) {
        const last3 = metric.series.slice(-3);
        const avg = last3.reduce((sum, s) => sum + s.value, 0) / 3;
        
        const lastPeriod = metric.series[metric.series.length - 1]?.period;
        if (!lastPeriod) return;
        const nextPeriod = this.getNextMonth(lastPeriod);
        
        baselinePoints.push({
          period: nextPeriod,
          metricKey: metric.key,
          metricLabel: metric.label,
          predictedValue: avg,
          confidence: metric.series.length > 6 ? 0.6 : 0.4,
          scenario: "BASE",
          explanation: "Baseline calculated using 3-period moving average.",
        });
      }
    });

    return {
      readiness: {
        canForecast: true,
        reason: null,
        historyPeriods: maxHistory,
        dateCoverage: {
          start: minDate ? (minDate as Date).toISOString().split("T")[0] || "" : null,
          end: maxDate ? (maxDate as Date).toISOString().split("T")[0] || "" : null,
        },
      },
      detectedMetrics,
      baselineForecast: {
        method: "moving_average",
        points: baselinePoints,
      },
      dataQualityIssues: issues,
      summaryForAi: {
        metricsCount: detectedMetrics.length,
        periodsCount: maxHistory,
        coverage: `${minDate ? (minDate as Date).toLocaleDateString() : ""} - ${maxDate ? (maxDate as Date).toLocaleDateString() : ""}`,
      },
    };
  }

  private insufficientData(reason: string): PreprocessorResult {
    return {
      readiness: {
        canForecast: false,
        reason,
        historyPeriods: 0,
        dateCoverage: { start: null, end: null },
      },
      detectedMetrics: [],
      baselineForecast: { method: "none", points: [] },
      dataQualityIssues: [
        {
          type: "INSUFFICIENT_HISTORY",
          severity: "HIGH",
          title: "Insufficient data",
          description: reason,
          recommendation: "Please upload a file with at least 3-6 months of historical data.",
        },
      ],
      summaryForAi: {},
    };
  }

  private getYearMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  private getNextMonth(period: string): string {
    const parts = period.split("-");
    const year = parseInt(parts[0] || "0");
    const month = parseInt(parts[1] || "0");
    if (isNaN(year) || isNaN(month)) return period;
    const date = new Date(year, month, 1);
    return this.getYearMonth(date);
  }
}

export default new ForecastPreprocessorService();
